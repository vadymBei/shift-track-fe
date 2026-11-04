import {differenceInMinutes, isSameDay, isSameYear, isToday, isYesterday, subDays} from 'date-fns';
import {formatDate, toDate} from '../../../../shared/utils/date.utils';
import {pluralUk} from '../../../../shared/utils/text.utils';
import {ChatMessage, Conversation} from '../models/messenger.models';

/** Time in the list of chats: 14:05 today, "Вчора", the weekday this week, then the date. */
export function listTime(value: string): string {
  const date = toDate(value);
  if (isToday(date)) {
    return formatDate(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Вчора';
  }
  if (date > subDays(new Date(), 6)) {
    return formatDate(date, 'EEEEEE');
  }
  return formatDate(date, isSameYear(date, new Date()) ? 'd MMM' : 'dd.MM.yyyy');
}

/** The separator between days in a conversation. */
export function dayLabel(value: string): string {
  const date = toDate(value);
  if (isToday(date)) {
    return 'Сьогодні';
  }
  if (isYesterday(date)) {
    return 'Вчора';
  }
  return formatDate(date, isSameYear(date, new Date()) ? 'EEEE, d MMMM' : 'd MMMM yyyy');
}

export function messageTime(value: string): string {
  return formatDate(value, 'HH:mm');
}

export function sameDay(a: string, b: string): boolean {
  return isSameDay(toDate(a), toDate(b));
}

/** Messages of one author a few minutes apart are shown as one block. */
export function continuesBlock(previous: ChatMessage | undefined, message: ChatMessage): boolean {
  return !!previous
    && previous.type === 'Text'
    && message.type === 'Text'
    && previous.authorId === message.authorId
    && sameDay(previous.createdAt, message.createdAt)
    && differenceInMinutes(toDate(message.createdAt), toDate(previous.createdAt)) < 5;
}

export function conversationTitle(conversation: Conversation | undefined | null): string {
  if (!conversation) {
    return '';
  }
  return conversation.title || (conversation.type === 'Direct' ? 'Працівник недоступний' : 'Група');
}

export function membersLabel(count: number): string {
  return `${count} ${pluralUk(count, 'учасник', 'учасники', 'учасників')}`;
}

/** "Ви: …", "Олена: …" in groups, or the text. */
export function previewText(conversation: Conversation, me: number | null): string {
  const message = conversation.lastMessage;
  if (!message) {
    return conversation.type === 'Group' ? 'Група створена' : 'Напишіть перше повідомлення';
  }
  const text = message.isDeleted ? 'Повідомлення видалено' : (message.text || attachmentsLabel(message));
  if (message.type === 'System') {
    return text;
  }
  if (message.authorId === me) {
    return `Ви: ${text}`;
  }
  if (conversation.type === 'Group' && message.authorFullName) {
    return `${firstName(message.authorFullName)}: ${text}`;
  }
  return text;
}

/** For a message with files and no text: "Фото", "Фото (3)", "довідка.pdf", "Файли (2)". */
export function attachmentsLabel(message: ChatMessage): string {
  const attachments = message.attachments ?? [];
  if (!attachments.length) {
    return '';
  }
  if (attachments.every(x => x.isImage)) {
    return attachments.length === 1 ? 'Фото' : `Фото (${attachments.length})`;
  }
  return attachments.length === 1 ? attachments[0].fileName : `Файли (${attachments.length})`;
}

/** "Коваль Олена Ігорівна" → "Олена". */
export function firstName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').split(' ').filter(Boolean);
  return parts[1] ?? parts[0] ?? '';
}

/** "Олена друкує…", "Олена та Тарас друкують…". */
export function typingLabel(names: string[]): string {
  if (!names.length) {
    return '';
  }
  if (names.length === 1) {
    return `${names[0]} друкує…`;
  }
  if (names.length === 2) {
    return `${names[0]} та ${names[1]} друкують…`;
  }
  return `${names.length} учасники друкують…`;
}
