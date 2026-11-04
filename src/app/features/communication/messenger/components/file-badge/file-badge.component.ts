import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {fileBadge} from '../../utils/attachment-utils';

/** "PDF", "XLSX"… in the colour of the kind of document. */
@Component({
  selector: 'app-file-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="file-badge" [class]="'tone-' + badge().tone" aria-hidden="true">{{ badge().label }}</span>`,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
    }

    .file-badge {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: color-mix(in srgb, var(--tone) 18%, transparent);
      color: var(--tone-text);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;

      &.tone-red { --tone: var(--p-red-500); --tone-text: var(--p-red-600); }
      &.tone-blue { --tone: var(--p-blue-500); --tone-text: var(--p-blue-600); }
      &.tone-green { --tone: var(--p-green-500); --tone-text: var(--p-green-600); }
      &.tone-orange { --tone: var(--p-orange-500); --tone-text: var(--p-orange-600); }
      &.tone-gray { --tone: var(--p-surface-500); --tone-text: var(--p-surface-600); }
      &.tone-violet { --tone: var(--p-violet-500); --tone-text: var(--p-violet-600); }

      :host-context(.mine) & {
        background: color-mix(in srgb, var(--p-primary-contrast-color) 22%, transparent);
        color: var(--p-primary-contrast-color);
      }
    }

    :host-context(.app-dark) .file-badge {
      &.tone-red { --tone-text: var(--p-red-300); }
      &.tone-blue { --tone-text: var(--p-blue-300); }
      &.tone-green { --tone-text: var(--p-green-300); }
      &.tone-orange { --tone-text: var(--p-orange-300); }
      &.tone-gray { --tone-text: var(--p-surface-300); }
      &.tone-violet { --tone-text: var(--p-violet-300); }
    }
  `
})
export class FileBadgeComponent {
  readonly fileName = input.required<string>();

  readonly badge = computed(() => fileBadge(this.fileName()));
}
