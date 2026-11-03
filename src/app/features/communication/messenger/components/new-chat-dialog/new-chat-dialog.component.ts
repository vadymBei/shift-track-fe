import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {MessengerStore} from '../../services/messenger.store';
import {ChatContact, Conversation} from '../../models/messenger.models';
import {ContactPickerComponent} from '../contact-picker/contact-picker.component';
import {conversationTitle} from '../../utils/messenger-format';

export type NewChatMode = 'direct' | 'group' | 'add';

export interface NewChatDialogData {
  mode: NewChatMode;
  /** The group to add members to ("add"). */
  conversation?: Conversation;
}

const MAX_TITLE = 100;

/**
 * Start a chat with a colleague, create a group or add members to a group.
 * Closes with the conversation to open, or nothing.
 */
@Component({
  selector: 'app-new-chat-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, InputText, ContactPickerComponent],
  templateUrl: './new-chat-dialog.component.html',
  styleUrl: './new-chat-dialog.component.scss'
})
export class NewChatDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly store = inject(MessengerStore);
  private readonly data = (inject(DynamicDialogConfig).data ?? {mode: 'direct'}) as NewChatDialogData;

  readonly mode = signal<NewChatMode>(this.data.mode);
  readonly title = signal('');
  readonly selected = signal<ChatContact[]>([]);
  readonly saving = signal(false);
  readonly maxTitle = MAX_TITLE;

  readonly selectedIds = computed(() => this.selected().map(x => x.employeeId));
  readonly memberIds = computed(() => this.data.conversation?.members.map(x => x.employeeId) ?? []);
  readonly groupName = conversationTitle(this.data.conversation);

  readonly heading = computed(() => ({
    direct: 'Новий чат',
    group: 'Нова група',
    add: 'Додати учасників'
  })[this.mode()]);

  readonly canSave = computed(() => this.mode() === 'group'
    ? this.title().trim().length > 0 && this.selected().length > 0
    : this.selected().length > 0);

  setMode(mode: NewChatMode): void {
    this.mode.set(mode);
    this.selected.set([]);
  }

  async pick(contact: ChatContact): Promise<void> {
    if (this.mode() !== 'direct') {
      this.selected.update(list => list.some(x => x.employeeId === contact.employeeId)
        ? list.filter(x => x.employeeId !== contact.employeeId)
        : [...list, contact]);
      return;
    }

    this.saving.set(true);
    try {
      this.ref.close(await this.store.openDirect(contact.employeeId));
    } catch {
      this.saving.set(false);
    }
  }

  unselect(contact: ChatContact): void {
    this.selected.update(list => list.filter(x => x.employeeId !== contact.employeeId));
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) {
      return;
    }
    this.saving.set(true);
    try {
      const conversation = this.mode() === 'group'
        ? await this.store.createGroup(this.title().trim(), this.selectedIds())
        : await this.store.addMembers(this.data.conversation!.id, this.selectedIds());
      this.ref.close(conversation);
    } catch {
      this.saving.set(false);
    }
  }

  close(): void {
    this.ref.close();
  }
}
