import {ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {Tag} from 'primeng/tag';
import {Tooltip} from 'primeng/tooltip';
import {ConfirmService} from '../../../../../shared/services/confirm.service';
import {MessengerStore} from '../../services/messenger.store';
import {ChatMember, Conversation} from '../../models/messenger.models';
import {ChatAvatarComponent} from '../chat-avatar/chat-avatar.component';
import {conversationTitle, membersLabel} from '../../utils/messenger-format';

/** The other member of a direct chat, or the group with its members and management. */
@Component({
  selector: 'app-conversation-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, InputText, Tag, Tooltip, ChatAvatarComponent],
  templateUrl: './conversation-details.component.html',
  styleUrl: './conversation-details.component.scss'
})
export class ConversationDetailsComponent {
  private readonly store = inject(MessengerStore);
  private readonly confirm = inject(ConfirmService);

  readonly conversation = input.required<Conversation>();

  readonly close = output<void>();
  readonly addMembers = output<void>();
  readonly left = output<void>();

  readonly renaming = signal(false);
  readonly title = signal('');
  readonly saving = signal(false);

  readonly me = this.store.me;
  readonly isGroup = computed(() => this.conversation().type === 'Group');
  readonly name = computed(() => conversationTitle(this.conversation()));
  readonly membersCount = computed(() => membersLabel(this.conversation().members.length));

  /** The owner manages the group; without an available owner, the earliest member does (as on the server). */
  readonly canManage = computed(() => {
    const conversation = this.conversation();
    return conversation.myRole === 'Owner'
      || (!conversation.members.some(x => x.role === 'Owner') && conversation.members[0]?.employeeId === this.me());
  });

  readonly members = computed(() => {
    const me = this.me();
    return [...this.conversation().members].sort((a, b) =>
      Number(b.role === 'Owner') - Number(a.role === 'Owner')
      || Number(b.employeeId === me) - Number(a.employeeId === me)
      || (a.fullName ?? '').localeCompare(b.fullName ?? '', 'uk'));
  });

  constructor() {
    effect(() => {
      this.conversation().id;
      untracked(() => this.renaming.set(false));
    });
  }

  startRename(): void {
    this.title.set(this.conversation().title ?? '');
    this.renaming.set(true);
  }

  async saveTitle(): Promise<void> {
    const title = this.title().trim();
    if (!title || this.saving()) {
      return;
    }
    if (title === this.conversation().title) {
      this.renaming.set(false);
      return;
    }
    this.saving.set(true);
    try {
      await this.store.rename(this.conversation().id, title);
      this.renaming.set(false);
    } finally {
      this.saving.set(false);
    }
  }

  remove(member: ChatMember): void {
    this.confirm.confirm({
      header: 'Видалити з групи?',
      message: `${member.fullName} більше не бачитиме цю групу.`,
      acceptLabel: 'Видалити',
      acceptSeverity: 'danger',
      icon: 'pi pi-user-minus',
      onConfirm: () => void this.store.removeMember(this.conversation().id, member.employeeId).catch(() => undefined)
    });
  }

  leave(): void {
    this.confirm.confirm({
      header: 'Вийти з групи?',
      message: 'Ви більше не бачитимете повідомлення групи. Повернутися можна, лише якщо вас додасть учасник.',
      acceptLabel: 'Вийти',
      acceptSeverity: 'danger',
      icon: 'pi pi-sign-out',
      onConfirm: () => void this.store.leave(this.conversation().id)
        .then(() => this.left.emit())
        .catch(() => undefined)
    });
  }

  place(member: ChatMember): string {
    return [member.departmentName, member.unitName].filter(Boolean).join(' · ');
  }

  subtitle(member: ChatMember | null): string {
    return member ? [member.positionName, member.departmentName].filter(Boolean).join(' · ') : '';
  }
}
