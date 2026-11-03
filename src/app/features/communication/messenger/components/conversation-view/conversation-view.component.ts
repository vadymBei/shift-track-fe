import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {MenuItem} from 'primeng/api';
import {Button} from 'primeng/button';
import {Menu} from 'primeng/menu';
import {Skeleton} from 'primeng/skeleton';
import {Textarea} from 'primeng/textarea';
import {Tooltip} from 'primeng/tooltip';
import {ConfirmService} from '../../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {MessengerStore} from '../../services/messenger.store';
import {ChatMessage, Conversation, DisplayMessage} from '../../models/messenger.models';
import {ChatAvatarComponent} from '../chat-avatar/chat-avatar.component';
import {
  continuesBlock,
  conversationTitle,
  dayLabel,
  firstName,
  membersLabel,
  messageTime,
  sameDay,
  typingLabel
} from '../../utils/messenger-format';

const MAX_LENGTH = 4000;
const NEAR_BOTTOM_PX = 120;
const LOAD_OLDER_AT_PX = 160;
/** The composer grows up to this height (as in the styles), then scrolls. */
const COMPOSER_MAX_HEIGHT_PX = 160;
const LONG_PRESS_MS = 500;

interface MessageRow {
  /** The client id keeps the element when an unsent message is replaced by the saved one. */
  key: string;
  message: DisplayMessage;
  mine: boolean;
  /** The first message of a new day. */
  day: string | null;
  /** Continues the block of the previous message of the same author. */
  continues: boolean;
  /** The next message continues this block: the time and the avatar are shown on the last one. */
  continued: boolean;
  read: boolean;
}

/** Drafts survive switching between conversations. */
const drafts = new Map<number, string>();

@Component({
  selector: 'app-conversation-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Button, Menu, Skeleton, Textarea, Tooltip, ChatAvatarComponent],
  templateUrl: './conversation-view.component.html',
  styleUrl: './conversation-view.component.scss'
})
export class ConversationViewComponent {
  private readonly store = inject(MessengerStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationService);

  readonly conversationId = input.required<number>();

  readonly showDetails = output<void>();

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly composer = viewChild<ElementRef<HTMLTextAreaElement>>('composer');
  private readonly actionsMenu = viewChild<Menu>('actionsMenu');

  readonly maxLength = MAX_LENGTH;
  readonly text = signal('');
  readonly replyTo = signal<ChatMessage | null>(null);
  readonly editing = signal<ChatMessage | null>(null);
  readonly saving = signal(false);
  readonly awayFromBottom = signal(false);
  readonly composerScrolls = signal(false);
  readonly actions = signal<MenuItem[]>([]);
  readonly skeletons = [1, 2, 3, 4];

  readonly me = this.store.me;
  readonly conversation = computed(() => this.store.conversation(this.conversationId()));
  readonly thread = computed(() => this.store.thread(this.conversationId()));
  readonly title = computed(() => conversationTitle(this.conversation()));
  readonly canWrite = computed(() => this.conversation()?.canWrite ?? false);

  readonly typing = computed(() => {
    const names = (this.store.typing()[this.conversationId()] ?? []).map(x => firstName(x.fullName));
    return typingLabel(names);
  });

  readonly subtitle = computed(() => {
    const conversation = this.conversation();
    if (!conversation) {
      return '';
    }
    if (conversation.type === 'Group') {
      return membersLabel(conversation.members.length);
    }
    const person = conversation.interlocutor;
    if (!person) {
      return 'Працівник більше не працює в компанії';
    }
    return [person.positionName, person.departmentName ?? person.unitName].filter(Boolean).join(' · ');
  });

  readonly rows = computed<MessageRow[]>(() => {
    const messages = this.thread().messages;
    const me = this.me();
    const readUpTo = this.conversation()?.readByOthersUpToMessageId ?? 0;

    return messages.map((message, index) => {
      const previous = messages[index - 1];
      const next = messages[index + 1];
      return {
        key: message.clientMessageId ?? `id:${message.id}`,
        message,
        mine: message.authorId === me && message.type === 'Text',
        day: !previous || !sameDay(previous.createdAt, message.createdAt) ? dayLabel(message.createdAt) : null,
        continues: continuesBlock(previous, message),
        continued: !!next && continuesBlock(message, next),
        read: message.id > 0 && message.id <= readUpTo
      };
    });
  });

  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScrollHeight = 0;
  private renderedFirstId: number | null = null;
  private renderedLastId: number | null = null;
  private renderedConversationId: number | null = null;

  constructor() {
    // Opening another conversation: its draft, no reply, the newest messages.
    effect(() => {
      const id = this.conversationId();
      untracked(() => {
        this.store.open(id);
        this.text.set(drafts.get(id) ?? '');
        this.updateComposerScroll();
        this.replyTo.set(null);
        this.editing.set(null);
        this.awayFromBottom.set(false);
      });
    });

    // Keeps the view at the bottom for new messages and in place when older ones are loaded above.
    effect(() => {
      const id = this.conversationId();
      const messages = this.thread().messages;
      const first = messages[0]?.id ?? null;
      const last = messages[messages.length - 1] ?? null;

      untracked(() => {
        const element = this.scroller()?.nativeElement;
        const switched = this.renderedConversationId !== id;
        const prepended = !switched && first !== this.renderedFirstId && last?.id === this.renderedLastId;
        const appended = !switched && last?.id !== this.renderedLastId;
        const stick = switched || (appended && (!this.awayFromBottom() || (!!last && last.authorId === this.me())));

        this.renderedConversationId = id;
        this.renderedFirstId = first;
        this.renderedLastId = last?.id ?? null;

        requestAnimationFrame(() => {
          const scroller = element ?? this.scroller()?.nativeElement;
          if (!scroller) {
            return;
          }
          if (prepended) {
            scroller.scrollTop += scroller.scrollHeight - this.lastScrollHeight;
          } else if (stick) {
            scroller.scrollTop = scroller.scrollHeight;
          }
          this.lastScrollHeight = scroller.scrollHeight;
        });
      });
    });
  }

  onScroll(): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller) {
      return;
    }
    this.lastScrollHeight = scroller.scrollHeight;
    this.awayFromBottom.set(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight > NEAR_BOTTOM_PX);

    if (scroller.scrollTop < LOAD_OLDER_AT_PX) {
      this.store.loadOlder(this.conversationId());
    }
  }

  scrollToBottom(): void {
    const scroller = this.scroller()?.nativeElement;
    scroller?.scrollTo({top: scroller.scrollHeight, behavior: 'smooth'});
  }

  scrollToMessage(id: number): void {
    const element = this.scroller()?.nativeElement.querySelector<HTMLElement>(`[data-message-id="${id}"]`);
    if (!element) {
      return;
    }
    element.scrollIntoView({behavior: 'smooth', block: 'center'});
    element.classList.add('highlight');
    setTimeout(() => element.classList.remove('highlight'), 1600);
  }

  // ---- composer

  onInput(value: string): void {
    this.text.set(value);
    this.updateComposerScroll();
    if (!this.editing()) {
      drafts.set(this.conversationId(), value);
      if (value.trim()) {
        this.store.notifyTyping(this.conversationId());
      }
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void this.submit();
    } else if (event.key === 'Escape' && (this.replyTo() || this.editing())) {
      event.preventDefault();
      this.cancelCompose();
    } else if (event.key === 'ArrowUp' && !this.text()) {
      const own = [...this.thread().messages].reverse()
        .find(x => x.authorId === this.me() && x.type === 'Text' && !x.isDeleted && x.id > 0);
      if (own) {
        event.preventDefault();
        this.startEdit(own);
      }
    }
  }

  async submit(): Promise<void> {
    const value = this.text().trim();
    if (!value || value.length > MAX_LENGTH || this.saving()) {
      return;
    }

    const editing = this.editing();
    if (editing) {
      if (value === editing.text) {
        this.cancelCompose();
        return;
      }
      this.saving.set(true);
      try {
        await this.store.edit(editing, value);
        this.cancelCompose();
      } finally {
        this.saving.set(false);
      }
      return;
    }

    this.store.send(this.conversationId(), value, this.replyTo());
    this.text.set('');
    drafts.delete(this.conversationId());
    this.replyTo.set(null);
    this.focusComposer();
  }

  cancelCompose(): void {
    const wasEditing = !!this.editing();
    this.replyTo.set(null);
    this.editing.set(null);
    if (wasEditing) {
      this.text.set(drafts.get(this.conversationId()) ?? '');
    }
    this.focusComposer();
  }

  startReply(message: ChatMessage): void {
    this.editing.set(null);
    this.replyTo.set(message);
    this.focusComposer();
  }

  startEdit(message: ChatMessage): void {
    this.replyTo.set(null);
    this.editing.set(message);
    this.text.set(message.text ?? '');
    this.focusComposer();
  }

  // ---- message actions

  openActions(event: Event, row: MessageRow): void {
    const message = row.message;
    const items: MenuItem[] = [];

    if (this.canWrite()) {
      items.push({label: 'Відповісти', icon: 'pi pi-reply', command: () => this.startReply(message)});
    }
    items.push({label: 'Копіювати текст', icon: 'pi pi-copy', command: () => this.copy(message)});
    if (row.mine) {
      items.push(
        {label: 'Редагувати', icon: 'pi pi-pencil', command: () => this.startEdit(message)},
        {label: 'Видалити', icon: 'pi pi-trash', styleClass: 'danger-item', command: () => this.remove(message)}
      );
    }

    this.actions.set(items);
    this.actionsMenu()?.toggle(event);
  }

  /** Right click on a message opens its actions, like in other messengers. */
  onContextMenu(event: MouseEvent, row: MessageRow): void {
    if (!this.hasActions(row)) {
      return;
    }
    event.preventDefault();
    this.openActions(event, row);
  }

  /** A long press on a phone opens the actions. */
  onPressStart(event: PointerEvent, row: MessageRow): void {
    if (event.pointerType !== 'touch' || !this.hasActions(row)) {
      return;
    }
    this.onPressEnd();
    this.pressTimer = setTimeout(() => {
      this.pressTimer = null;
      navigator.vibrate?.(15);
      this.openActions(event, row);
    }, LONG_PRESS_MS);
  }

  onPressEnd(): void {
    if (this.pressTimer) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  private hasActions(row: MessageRow): boolean {
    return row.message.id > 0 && !row.message.isDeleted && !row.message.delivery;
  }

  retry(message: DisplayMessage): void {
    this.store.retry(message);
  }

  discard(message: DisplayMessage): void {
    this.store.discard(message);
  }

  remove(message: ChatMessage): void {
    this.confirm.confirm({
      header: 'Видалити повідомлення?',
      message: 'Співрозмовники побачать, що повідомлення видалено.',
      acceptLabel: 'Видалити',
      acceptSeverity: 'danger',
      icon: 'pi pi-trash',
      onConfirm: () => void this.store.delete(message).then(() => {
        if (this.editing()?.id === message.id) {
          this.cancelCompose();
        }
      })
    });
  }

  private copy(message: ChatMessage): void {
    navigator.clipboard?.writeText(message.text ?? '')
      .then(() => this.toast.success('Текст скопійовано'))
      .catch(() => this.toast.warn('Не вдалося скопіювати'));
  }

  private focusComposer(): void {
    setTimeout(() => this.composer()?.nativeElement.focus());
    this.updateComposerScroll();
  }

  /** Measured after the field has resized to the new text. */
  private updateComposerScroll(): void {
    requestAnimationFrame(() => {
      const element = this.composer()?.nativeElement;
      this.composerScrolls.set(!!element && element.scrollHeight > COMPOSER_MAX_HEIGHT_PX);
    });
  }

  // ---- template helpers

  time(message: ChatMessage): string {
    return messageTime(message.createdAt);
  }

  avatarName(message: ChatMessage): string {
    return message.authorFullName ?? '';
  }

  isGroup(conversation: Conversation | undefined): boolean {
    return conversation?.type === 'Group';
  }

  avatarSeed(conversation: Conversation | undefined): number {
    return conversation?.type === 'Direct' ? conversation.interlocutor?.employeeId ?? 0 : conversation?.id ?? 0;
  }
}
