import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {ChatMessage} from '../../models/messenger.models';
import {textSegments} from '../../utils/mention-utils';

/** The text of a message with the mentions highlighted; a mention of the current user stands out. */
@Component({
  selector: 'app-message-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // On one line: the text keeps its line breaks (pre-wrap), so the template must add no spaces.
  template: `@for (segment of segments(); track $index) {@if (segment.mention) {<span class="mention" [class.me]="segment.mention.me">{{ segment.text }}</span>} @else {{{ segment.text }}}}`,
  styles: `
    :host {
      font-size: 14px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .mention {
      padding: 0 3px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
      color: var(--p-primary-color);
      font-weight: 600;

      &.me {
        background: color-mix(in srgb, var(--p-orange-500) 22%, transparent);
        color: inherit;
      }
    }

    :host-context(.mine) .mention {
      background: color-mix(in srgb, var(--p-primary-contrast-color) 22%, transparent);
      color: inherit;
    }
  `
})
export class MessageTextComponent {
  readonly message = input.required<Pick<ChatMessage, 'text' | 'mentions'>>();
  readonly me = input<number | null>(null);

  readonly segments = computed(() => textSegments(this.message(), this.me()));
}
