import {ChatMember, ChatMessage, MessageMention} from '../models/messenger.models';

/** How a mention is kept in the text: the id, so a renamed employee shows the new name. */
const TOKEN = /<@(\d+)>/g;

export interface TextSegment {
  text: string;
  /** Set for a mention. */
  mention?: {employeeId: number; label: string; me: boolean};
}

/** A mention chosen in the composer: the text shows "@label", the message gets "<@id>". */
export interface PickedMention {
  employeeId: number;
  label: string;
}

/** "Коваль Олена Ігорівна" → "Олена Коваль", as people are called in a chat. */
export function mentionLabel(fullName: string | null | undefined): string {
  const [surname, name] = (fullName ?? '').split(' ').filter(Boolean);
  return [name, surname].filter(Boolean).join(' ') || 'працівник';
}

function nameOf(mentions: MessageMention[] | undefined, employeeId: number): string {
  return mentionLabel(mentions?.find(x => x.employeeId === employeeId)?.fullName);
}

/** The text split into plain parts and mentions, for highlighting. */
export function textSegments(message: Pick<ChatMessage, 'text' | 'mentions'>, me: number | null): TextSegment[] {
  const text = message.text ?? '';
  const segments: TextSegment[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN)) {
    const employeeId = Number(match[1]);
    if (match.index! > last) {
      segments.push({text: text.slice(last, match.index)});
    }
    const label = nameOf(message.mentions, employeeId);
    segments.push({text: `@${label}`, mention: {employeeId, label, me: employeeId === me}});
    last = match.index! + match[0].length;
  }
  if (last < text.length) {
    segments.push({text: text.slice(last)});
  }
  return segments;
}

/** "@Олена Коваль" instead of the tokens: previews, pop-ups, copying. */
export function plainText(message: Pick<ChatMessage, 'text' | 'mentions'>): string {
  return (message.text ?? '').replace(TOKEN, (_, id) => `@${nameOf(message.mentions, Number(id))}`);
}

export function mentionsMe(message: Pick<ChatMessage, 'mentions'>, me: number | null): boolean {
  return !!me && (message.mentions ?? []).some(x => x.employeeId === me);
}

/** The composer text with "<@id>" for every "@label" that is still there. */
export function serializeMentions(text: string, picked: PickedMention[]): string {
  let result = text;
  for (const mention of picked) {
    const index = result.indexOf(`@${mention.label}`);
    if (index >= 0) {
      result = result.slice(0, index) + `<@${mention.employeeId}>` + result.slice(index + mention.label.length + 1);
    }
  }
  return result;
}

/** A saved text for editing: the tokens become "@label" again. */
export function deserializeMentions(message: Pick<ChatMessage, 'text' | 'mentions'>): {text: string; picked: PickedMention[]} {
  const picked: PickedMention[] = [];
  const text = (message.text ?? '').replace(TOKEN, (_, id) => {
    const employeeId = Number(id);
    const label = nameOf(message.mentions, employeeId);
    picked.push({employeeId, label});
    return `@${label}`;
  });
  return {text, picked};
}

/** "@оле" right before the caret: what to suggest. Null when the caret isn't in a mention. */
export function mentionQuery(text: string, caret: number): {query: string; start: number} | null {
  const match = /(^|\s)@([\p{L}'’-]{0,30})$/u.exec(text.slice(0, caret));
  return match ? {query: match[2], start: caret - match[2].length - 1} : null;
}

/** Members whose name or surname starts with the query. */
export function mentionCandidates(members: ChatMember[], query: string, me: number | null, limit = 6): ChatMember[] {
  const q = query.toLocaleLowerCase('uk');
  return members
    .filter(x => x.employeeId !== me)
    .filter(x => !q || (x.fullName ?? '').toLocaleLowerCase('uk').split(' ').some(word => word.startsWith(q)))
    .slice(0, limit);
}
