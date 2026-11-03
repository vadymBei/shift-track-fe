import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {personInitials} from '../../../../../shared/utils/text.utils';

const TONES = 6;

/** Initials in a colour picked by the id, or a group icon. */
@Component({
  selector: 'app-chat-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="avatar" [class]="'tone-' + tone()" [style.--size.px]="size()" aria-hidden="true">
      @if (group()) {
        <i class="pi pi-users"></i>
      } @else {
        {{ initials() }}
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--size);
      height: var(--size);
      border-radius: 50%;
      font-size: calc(var(--size) * 0.36);
      font-weight: 700;
      letter-spacing: 0.02em;
      user-select: none;

      i {
        font-size: calc(var(--size) * 0.42);
      }
    }

    .tone-0 { --tone: var(--p-violet-500); --tone-text: var(--p-violet-700); }
    .tone-1 { --tone: var(--p-pink-500); --tone-text: var(--p-pink-700); }
    .tone-2 { --tone: var(--p-cyan-500); --tone-text: var(--p-cyan-700); }
    .tone-3 { --tone: var(--p-green-500); --tone-text: var(--p-green-700); }
    .tone-4 { --tone: var(--p-orange-500); --tone-text: var(--p-orange-700); }
    .tone-5 { --tone: var(--p-indigo-500); --tone-text: var(--p-indigo-700); }

    .avatar {
      background: color-mix(in srgb, var(--tone) 16%, transparent);
      color: var(--tone-text);
    }

    :host-context(.app-dark) {
      .tone-0 { --tone-text: var(--p-violet-300); }
      .tone-1 { --tone-text: var(--p-pink-300); }
      .tone-2 { --tone-text: var(--p-cyan-300); }
      .tone-3 { --tone-text: var(--p-green-300); }
      .tone-4 { --tone-text: var(--p-orange-300); }
      .tone-5 { --tone-text: var(--p-indigo-300); }

      .avatar {
        background: color-mix(in srgb, var(--tone) 24%, transparent);
      }
    }
  `
})
export class ChatAvatarComponent {
  readonly name = input<string | null>(null);
  readonly seed = input<number>(0);
  readonly group = input(false);
  readonly size = input(44);

  readonly initials = computed(() => personInitials(this.name() ?? '') || '?');
  readonly tone = computed(() => Math.abs(this.seed()) % TONES);
}
