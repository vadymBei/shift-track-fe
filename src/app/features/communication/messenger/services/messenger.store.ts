import {computed, effect, inject, Injectable, signal, untracked} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {Router} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {AccountService} from '../../../../core/account/services/account.service';
import {RealtimeService} from '../../../../core/realtime/realtime.service';
import {NotificationService} from '../../../../shared/services/notification.service';
import {MESSAGES_PAGE, MessengerApiService} from './messenger-api.service';
import {
  ChatMessage,
  Conversation,
  ConversationRead,
  DisplayMessage,
  MessengerUnreadCount,
  Typing
} from '../models/messenger.models';

/** Messages of one conversation, oldest first; unsaved messages are at the end. */
export interface Thread {
  messages: DisplayMessage[];
  loaded: boolean;
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
}

export interface TypingPerson {
  employeeId: number;
  fullName: string;
  until: number;
}

const EMPTY_THREAD: Thread = {messages: [], loaded: false, loading: false, hasOlder: false, loadingOlder: false};
const TYPING_SHOWN_MS = 5_000;
const TYPING_SENT_EVERY_MS = 3_000;
const UNREAD_REFRESH_DELAY_MS = 400;
export const MESSENGER_ROUTE = '/messages';

/**
 * Chats of the signed-in user: the list, loaded messages, unread counters and typing,
 * kept current by the real-time events. Sending is optimistic: a message is shown at once
 * and matched with the saved one by its client id, so a retry never duplicates it.
 */
@Injectable({providedIn: 'root'})
export class MessengerStore {
  private readonly api = inject(MessengerApiService);
  private readonly accountService = inject(AccountService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(NotificationService);
  private readonly router = inject(Router);

  readonly conversations = signal<Conversation[]>([]);
  readonly conversationsLoaded = signal(false);
  readonly conversationsLoading = signal(false);
  readonly unread = signal<MessengerUnreadCount>({conversations: 0, messages: 0});
  readonly threads = signal<Record<number, Thread>>({});
  readonly typing = signal<Record<number, TypingPerson[]>>({});

  /** The conversation open on the screen. */
  readonly activeId = signal<number | null>(null);

  /** The open conversation stopped being available (removed from the group, the group was deleted). */
  readonly lostAccess = signal<number | null>(null);

  readonly me = computed(() => this.accountService.currentUser()?.employee?.id ?? null);

  private readonly pageVisible = signal(typeof document === 'undefined' || document.visibilityState === 'visible');
  private employeeId: number | null = null;
  private unreadTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly typingSentAt = new Map<number, number>();
  private readonly markingRead = new Map<number, number>();
  private tempId = 0;

  constructor() {
    this.realtime.on<ChatMessage>('chatMessageCreated', message => this.onMessageCreated(message));
    this.realtime.on<ChatMessage>('chatMessageUpdated', message => this.onMessageUpdated(message));
    this.realtime.on<number>('chatConversationChanged', id => this.onConversationChanged(id));
    this.realtime.on<ConversationRead>('chatConversationRead', read => this.onConversationRead(read));
    this.realtime.on<Typing>('chatTyping', typing => this.onTyping(typing));
    this.realtime.onReconnected(() => this.resync());

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.pageVisible.set(document.visibilityState === 'visible');
        if (this.pageVisible()) {
          this.markActiveRead();
        }
      });
    }

    effect(() => {
      const employeeId = this.me();
      untracked(() => this.onUserChanged(employeeId));
    });
  }

  conversation(id: number | null): Conversation | undefined {
    return id === null ? undefined : this.conversations().find(x => x.id === id);
  }

  thread(id: number | null): Thread {
    return (id !== null && this.threads()[id]) || EMPTY_THREAD;
  }

  // ---- loading

  loadConversations(): void {
    this.conversationsLoading.set(true);
    this.api.getConversations().subscribe({
      next: conversations => {
        this.conversations.set(sortConversations(conversations ?? []));
        this.conversationsLoaded.set(true);
        this.conversationsLoading.set(false);
      },
      error: () => this.conversationsLoading.set(false)
    });
  }

  refreshUnread(): void {
    if (this.unreadTimer) {
      clearTimeout(this.unreadTimer);
    }
    this.unreadTimer = setTimeout(() => {
      this.unreadTimer = null;
      this.api.getUnreadCount().subscribe({next: count => this.unread.set(count), error: () => undefined});
    }, UNREAD_REFRESH_DELAY_MS);
  }

  /** Loads the conversation into the list. Null when it isn't available to the user. */
  async fetchConversation(id: number): Promise<Conversation | null> {
    try {
      const conversation = await firstValueFrom(this.api.getConversation(id));
      this.upsert(conversation);
      return conversation;
    } catch (error) {
      if (error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404)) {
        this.forget(id);
      }
      return null;
    }
  }

  /** Makes the conversation the open one and loads its newest messages once. */
  open(id: number | null): void {
    this.activeId.set(id);
    this.lostAccess.set(null);

    if (id === null) {
      return;
    }
    if (!this.conversation(id)) {
      void this.fetchConversation(id);
    }
    const thread = this.thread(id);
    if (!thread.loaded && !thread.loading) {
      this.loadLatest(id);
    } else {
      this.markActiveRead();
    }
  }

  loadOlder(id: number): void {
    const thread = this.thread(id);
    const oldest = thread.messages.find(x => x.id > 0);
    if (!thread.hasOlder || thread.loadingOlder || !oldest) {
      return;
    }
    this.patchThread(id, {loadingOlder: true});
    this.api.getMessages(id, oldest.id).subscribe({
      next: page => this.patchThread(id, current => ({
        messages: mergeMessages(page, current.messages),
        hasOlder: page.length >= MESSAGES_PAGE,
        loadingOlder: false
      })),
      error: () => this.patchThread(id, {loadingOlder: false})
    });
  }

  private loadLatest(id: number): void {
    this.patchThread(id, {loading: true});
    this.api.getMessages(id).subscribe({
      next: page => {
        this.patchThread(id, current => {
          const newestKnown = maxId(current.messages);
          // Too much was missed (a long disconnect): start over from the newest page.
          const gap = page.length >= MESSAGES_PAGE && newestKnown > 0 && page[0].id > newestKnown;
          const kept = gap ? current.messages.filter(x => x.id < 0) : current.messages;
          return {
            messages: mergeMessages(page, kept),
            loaded: true,
            loading: false,
            hasOlder: current.loaded && !gap ? current.hasOlder || page.length >= MESSAGES_PAGE : page.length >= MESSAGES_PAGE
          };
        });
        this.markActiveRead();
      },
      error: () => this.patchThread(id, {loading: false})
    });
  }

  // ---- sending

  send(conversationId: number, text: string, replyTo: ChatMessage | null): void {
    const me = this.me();
    const value = text.trim();
    if (!me || !value) {
      return;
    }

    const message: DisplayMessage = {
      id: --this.tempId,
      conversationId,
      type: 'Text',
      text: value,
      authorId: me,
      authorFullName: this.accountService.currentUser()?.employee?.fullName ?? null,
      createdAt: new Date().toISOString(),
      editedAt: null,
      isDeleted: false,
      clientMessageId: newClientId(),
      replyTo: replyTo ? {
        id: replyTo.id,
        authorId: replyTo.authorId,
        authorFullName: replyTo.authorFullName,
        text: replyTo.text,
        isDeleted: replyTo.isDeleted
      } : null,
      delivery: 'sending'
    };

    this.patchThread(conversationId, current => ({messages: [...current.messages, message]}));
    this.touchConversation(conversationId, message);
    this.post(message);
  }

  retry(message: DisplayMessage): void {
    this.replaceMessage(message.conversationId, x => x.clientMessageId === message.clientMessageId,
      x => ({...x, delivery: 'sending'}));
    this.post(message);
  }

  discard(message: DisplayMessage): void {
    this.patchThread(message.conversationId, current => ({
      messages: current.messages.filter(x => x.clientMessageId !== message.clientMessageId || x.id > 0)
    }));
  }

  private post(message: DisplayMessage): void {
    this.api.send(message.conversationId, message.text ?? '', message.clientMessageId!, message.replyTo?.id ?? null)
      .subscribe({
        next: saved => this.acceptMessage(saved),
        error: (error: HttpErrorResponse) => {
          this.replaceMessage(message.conversationId, x => x.clientMessageId === message.clientMessageId && x.id < 0,
            x => ({...x, delivery: 'failed'}));
          if (error.status === 429) {
            this.toast.warn('Ви надсилаєте повідомлення занадто часто. Зачекайте кілька секунд.');
          }
        }
      });
  }

  async edit(message: ChatMessage, text: string): Promise<void> {
    const saved = await firstValueFrom(this.api.edit(message.id, text.trim()));
    this.acceptMessage(saved);
  }

  async delete(message: ChatMessage): Promise<void> {
    const saved = await firstValueFrom(this.api.delete(message.id));
    this.acceptMessage(saved);
  }

  /** Lets the others see "typing…"; sent at most every few seconds. */
  notifyTyping(conversationId: number): void {
    const now = Date.now();
    if (now - (this.typingSentAt.get(conversationId) ?? 0) < TYPING_SENT_EVERY_MS) {
      return;
    }
    this.typingSentAt.set(conversationId, now);
    this.api.typing(conversationId).subscribe({error: () => undefined});
  }

  // ---- conversations

  async openDirect(employeeId: number): Promise<Conversation> {
    const conversation = await firstValueFrom(this.api.openDirect(employeeId));
    this.upsert(conversation);
    return conversation;
  }

  async createGroup(title: string, memberIds: number[]): Promise<Conversation> {
    return this.upsert(await firstValueFrom(this.api.createGroup(title, memberIds)));
  }

  async rename(id: number, title: string): Promise<Conversation> {
    return this.upsert(await firstValueFrom(this.api.renameGroup(id, title)));
  }

  async addMembers(id: number, employeeIds: number[]): Promise<Conversation> {
    return this.upsert(await firstValueFrom(this.api.addMembers(id, employeeIds)));
  }

  async removeMember(id: number, employeeId: number): Promise<Conversation> {
    return this.upsert(await firstValueFrom(this.api.removeMember(id, employeeId)));
  }

  async leave(id: number): Promise<void> {
    await firstValueFrom(this.api.leave(id));
    this.forget(id);
    this.refreshUnread();
  }

  // ---- reading

  /** Marks the open conversation read up to its newest message, when the user can see it. */
  markActiveRead(): void {
    const id = this.activeId();
    const conversation = this.conversation(id);
    const thread = this.thread(id);
    const me = this.me();
    if (id === null || !conversation || !thread.loaded || !this.pageVisible() || !me) {
      return;
    }

    const newest = maxId(thread.messages);
    const myMember = conversation.members.find(x => x.employeeId === me);
    const readUpTo = Math.max(myMember?.lastReadMessageId ?? 0, this.markingRead.get(id) ?? 0);
    if (newest <= 0 || newest <= readUpTo) {
      return;
    }

    this.markingRead.set(id, newest);
    const hadUnread = conversation.unreadCount;
    this.updateConversation(id, x => ({
      ...x,
      unreadCount: 0,
      members: x.members.map(m => m.employeeId === me ? {...m, lastReadMessageId: newest} : m)
    }));
    if (hadUnread > 0) {
      this.unread.update(count => ({
        conversations: Math.max(count.conversations - 1, 0),
        messages: Math.max(count.messages - hadUnread, 0)
      }));
    }

    this.api.markRead(id, newest).subscribe({
      next: () => this.markingRead.delete(id),
      error: () => {
        this.markingRead.delete(id);
        this.refreshUnread();
      }
    });
  }

  // ---- real-time

  private onMessageCreated(message: ChatMessage): void {
    const me = this.me();
    const fromOthers = message.authorId !== me;

    if (this.threads()[message.conversationId]) {
      this.patchThread(message.conversationId, current => ({messages: mergeMessages([message], current.messages)}));
    }
    this.dropTyping(message.conversationId, message.authorId);

    const known = this.conversation(message.conversationId);
    const watching = this.activeId() === message.conversationId && this.pageVisible()
      && this.thread(message.conversationId).loaded;

    if (known) {
      this.touchConversation(message.conversationId, message);
      if (fromOthers && !watching) {
        this.updateConversation(message.conversationId, x => ({...x, unreadCount: x.unreadCount + 1}));
        this.unread.update(count => ({
          conversations: count.conversations + (known.unreadCount === 0 ? 1 : 0),
          messages: count.messages + 1
        }));
      }
    } else if (this.conversationsLoaded() || this.activeId() === message.conversationId) {
      void this.fetchConversation(message.conversationId);
    }

    if (fromOthers) {
      if (watching) {
        this.markActiveRead();
      } else {
        this.refreshUnread();
        this.announce(message);
      }
    }
  }

  private onMessageUpdated(message: ChatMessage): void {
    this.replaceMessage(message.conversationId, x => x.id === message.id, () => message);
    this.updateConversation(message.conversationId, x =>
      x.lastMessage?.id === message.id ? {...x, lastMessage: message} : x);

    if (message.isDeleted && message.authorId !== this.me()) {
      // It may have been unread: the server knows the counters.
      void this.fetchConversation(message.conversationId);
      this.refreshUnread();
    }
  }

  private onConversationChanged(id: number): void {
    if (this.conversationsLoaded() || this.conversation(id) || this.threads()[id]) {
      void this.fetchConversation(id);
    }
    this.refreshUnread();
  }

  private onConversationRead(read: ConversationRead): void {
    if (read.employeeId === this.me()) {
      // Read in another tab.
      void this.fetchConversation(read.conversationId);
      this.refreshUnread();
      return;
    }

    this.updateConversation(read.conversationId, x => ({
      ...x,
      readByOthersUpToMessageId: Math.max(x.readByOthersUpToMessageId ?? 0, read.lastReadMessageId),
      members: x.members.map(m => m.employeeId === read.employeeId
        ? {...m, lastReadMessageId: Math.max(m.lastReadMessageId ?? 0, read.lastReadMessageId)}
        : m)
    }));
  }

  private onTyping(typing: Typing): void {
    const until = Date.now() + TYPING_SHOWN_MS;
    this.typing.update(all => ({
      ...all,
      [typing.conversationId]: [
        ...(all[typing.conversationId] ?? []).filter(x => x.employeeId !== typing.employeeId),
        {employeeId: typing.employeeId, fullName: typing.fullName, until}
      ]
    }));
    setTimeout(() => this.typing.update(all => ({
      ...all,
      [typing.conversationId]: (all[typing.conversationId] ?? []).filter(x => x.until > Date.now())
    })), TYPING_SHOWN_MS + 50);
  }

  /** Events may have been missed while disconnected. */
  private resync(): void {
    this.refreshUnread();
    if (this.conversationsLoaded()) {
      this.loadConversations();
    }

    const active = this.activeId();
    // Other threads are loaded again when they are opened.
    this.threads.update(all => Object.fromEntries(Object.entries(all)
      .filter(([id]) => Number(id) === active)));
    if (active !== null) {
      this.loadLatest(active);
    }
  }

  private announce(message: ChatMessage): void {
    if (message.type !== 'Text' || this.router.url.startsWith(MESSENGER_ROUTE)) {
      return;
    }
    const conversation = this.conversation(message.conversationId);
    const title = conversation?.type === 'Group'
      ? `${message.authorFullName ?? ''} · ${conversation.title ?? ''}`
      : message.authorFullName ?? 'Нове повідомлення';
    this.toast.info(shorten(message.text ?? '', 120), title);
  }

  // ---- state helpers

  private onUserChanged(employeeId: number | null): void {
    if (employeeId === this.employeeId) {
      return;
    }
    this.employeeId = employeeId;
    this.conversations.set([]);
    this.conversationsLoaded.set(false);
    this.threads.set({});
    this.typing.set({});
    this.activeId.set(null);
    this.unread.set({conversations: 0, messages: 0});

    if (employeeId) {
      this.refreshUnread();
    }
  }

  /** A saved message replaces the shown one with the same id or client id. */
  private acceptMessage(saved: ChatMessage): void {
    this.patchThread(saved.conversationId, current => ({messages: mergeMessages([saved], current.messages)}));
    this.touchConversation(saved.conversationId, saved);

    const me = this.me();
    if (saved.authorId === me) {
      // Own messages are read by the author.
      this.updateConversation(saved.conversationId, x => ({
        ...x,
        members: x.members.map(m => m.employeeId === me
          ? {...m, lastReadMessageId: Math.max(m.lastReadMessageId ?? 0, saved.id)}
          : m)
      }));
    }
  }

  private touchConversation(id: number, message: ChatMessage): void {
    this.updateConversation(id, x => {
      const newer = !x.lastMessage || message.id < 0 || x.lastMessage.id < 0 || message.id >= x.lastMessage.id;
      return newer ? {...x, lastMessage: message, lastActivityAt: message.createdAt} : x;
    });
  }

  private upsert(conversation: Conversation): Conversation {
    this.conversations.update(list => sortConversations([
      conversation,
      ...list.filter(x => x.id !== conversation.id)
    ]));
    return conversation;
  }

  private forget(id: number): void {
    this.conversations.update(list => list.filter(x => x.id !== id));
    this.threads.update(all => {
      const {[id]: _, ...rest} = all;
      return rest;
    });
    if (this.activeId() === id) {
      this.lostAccess.set(id);
    }
  }

  private updateConversation(id: number, change: (conversation: Conversation) => Conversation): void {
    this.conversations.update(list => {
      const index = list.findIndex(x => x.id === id);
      if (index < 0) {
        return list;
      }
      const next = [...list];
      next[index] = change(list[index]);
      return sortConversations(next);
    });
  }

  private patchThread(id: number, patch: Partial<Thread> | ((thread: Thread) => Partial<Thread>)): void {
    this.threads.update(all => {
      const current = all[id] ?? EMPTY_THREAD;
      const change = typeof patch === 'function' ? patch(current) : patch;
      return {...all, [id]: {...current, ...change}};
    });
  }

  private replaceMessage(conversationId: number, match: (message: DisplayMessage) => boolean,
                         change: (message: DisplayMessage) => DisplayMessage): void {
    if (!this.threads()[conversationId]) {
      return;
    }
    this.patchThread(conversationId, current => ({
      messages: current.messages.map(x => match(x) ? change(x) : x)
    }));
  }

  private dropTyping(conversationId: number, employeeId: number | null): void {
    if (!this.typing()[conversationId]?.length) {
      return;
    }
    this.typing.update(all => ({
      ...all,
      [conversationId]: (all[conversationId] ?? []).filter(x => x.employeeId !== employeeId)
    }));
  }
}

/** Saved messages by id, then the unsaved ones; a saved message replaces its unsaved copy. */
export function mergeMessages(incoming: ChatMessage[], existing: DisplayMessage[]): DisplayMessage[] {
  const byId = new Map<number, DisplayMessage>();
  const savedClientIds = new Set<string>();

  for (const message of existing) {
    if (message.id > 0) {
      byId.set(message.id, message);
    }
  }
  for (const message of incoming) {
    byId.set(message.id, message);
  }
  for (const message of byId.values()) {
    if (message.clientMessageId) {
      savedClientIds.add(message.clientMessageId);
    }
  }

  const saved = [...byId.values()].sort((a, b) => a.id - b.id);
  const pending = existing.filter(x => x.id < 0 && !(x.clientMessageId && savedClientIds.has(x.clientMessageId)));
  return [...saved, ...pending];
}

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt) || b.id - a.id);
}

function maxId(messages: DisplayMessage[]): number {
  return messages.reduce((max, x) => Math.max(max, x.id), 0);
}

function shorten(text: string, length: number): string {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // crypto.randomUUID exists only on https and localhost.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
