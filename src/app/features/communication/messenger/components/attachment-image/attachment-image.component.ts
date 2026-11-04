import {ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked} from '@angular/core';
import {Skeleton} from 'primeng/skeleton';
import {AttachmentFilesService} from '../../services/attachment-files.service';
import {ChatAttachment} from '../../models/messenger.models';

/** A picture from the chat; it needs the token, so it is loaded as a blob. */
@Component({
  selector: 'app-attachment-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Skeleton],
  template: `
    @if (url(); as src) {
      <img [src]="src" [alt]="attachment().fileName" loading="lazy" decoding="async"/>
    } @else if (failed()) {
      <span class="failed"><i class="pi pi-image" aria-hidden="true"></i> Не вдалося завантажити</span>
    } @else {
      <p-skeleton width="100%" height="100%" borderRadius="0"/>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .failed {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 100%;
      color: var(--p-text-muted-color);
      font-size: 12px;
    }
  `
})
export class AttachmentImageComponent {
  private readonly files = inject(AttachmentFilesService);

  readonly attachment = input.required<ChatAttachment>();

  readonly url = signal<string | null>(null);
  readonly failed = signal(false);

  constructor() {
    effect(() => {
      const attachment = this.attachment();
      untracked(() => {
        this.url.set(null);
        this.failed.set(false);
        this.files.preview(attachment)
          .then(url => attachment === this.attachment() && this.url.set(url))
          .catch(() => this.failed.set(true));
      });
    });
  }
}
