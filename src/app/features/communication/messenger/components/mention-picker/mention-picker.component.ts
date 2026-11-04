import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
import {ChatMember} from '../../models/messenger.models';
import {mentionLabel} from '../../utils/mention-utils';
import {ChatAvatarComponent} from '../chat-avatar/chat-avatar.component';

/** Members to mention after "@": ↑ ↓ to choose, Enter or Tab to insert (handled by the composer). */
@Component({
  selector: 'app-mention-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatAvatarComponent],
  template: `
    <ul class="picker" role="listbox" id="mention-picker" aria-label="Кого згадати">
      @for (member of options(); track member.employeeId; let index = $index) {
        <li role="option" class="option" [id]="'mention-option-' + index"
            [class.active]="index === activeIndex()" [attr.aria-selected]="index === activeIndex()"
            (mousedown)="$event.preventDefault(); pick.emit(member)">
          <app-chat-avatar [name]="member.fullName" [seed]="member.employeeId" [size]="28"/>
          <span class="name">{{ label(member) }}</span>
          @if (member.positionName) {
            <span class="position">{{ member.positionName }}</span>
          }
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      position: absolute;
      left: 12px;
      bottom: calc(100% - 4px);
      z-index: 6;
      width: min(340px, calc(100% - 24px));
    }

    .picker {
      margin: 0;
      padding: 4px;
      list-style: none;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--app-radius-md);
      background: var(--p-content-background);
      box-shadow: var(--app-shadow-md);
    }

    .option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border-radius: var(--app-radius-sm);
      cursor: pointer;

      &.active,
      &:hover {
        background: var(--p-highlight-background);
      }
    }

    .name {
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
    }

    .position {
      overflow: hidden;
      color: var(--p-text-muted-color);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `
})
export class MentionPickerComponent {
  readonly options = input.required<ChatMember[]>();
  readonly activeIndex = input(0);

  readonly pick = output<ChatMember>();

  label(member: ChatMember): string {
    return mentionLabel(member.fullName);
  }
}
