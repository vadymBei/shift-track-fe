import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  input,
  OnDestroy,
  OnInit,
  output,
  signal
} from '@angular/core';
import {Button} from 'primeng/button';
import {AttachmentFilesService} from '../../services/attachment-files.service';
import {ChatAttachment} from '../../models/messenger.models';
import {AttachmentImageComponent} from '../attachment-image/attachment-image.component';

/** The pictures of a message on the whole screen, with ← → between them. */
@Component({
  selector: 'app-image-viewer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, AttachmentImageComponent],
  template: `
    <div class="viewer" role="dialog" aria-modal="true" [attr.aria-label]="current().fileName" (click)="close.emit()">
      <header class="bar" (click)="$event.stopPropagation()">
        <span class="name">{{ current().fileName }}</span>
        @if (images().length > 1) {
          <span class="count">{{ index() + 1 }} / {{ images().length }}</span>
        }
        <p-button icon="pi pi-download" [rounded]="true" [text]="true" ariaLabel="Завантажити" (onClick)="download()"/>
        <p-button icon="pi pi-times" [rounded]="true" [text]="true" ariaLabel="Закрити" (onClick)="close.emit()"/>
      </header>

      <div class="stage">
        @if (images().length > 1) {
          <button type="button" class="nav prev" aria-label="Попереднє" (click)="step(-1, $event)">
            <i class="pi pi-chevron-left" aria-hidden="true"></i>
          </button>
        }
        <div class="picture" (click)="$event.stopPropagation()">
          <app-attachment-image [attachment]="current()"/>
        </div>
        @if (images().length > 1) {
          <button type="button" class="nav next" aria-label="Наступне" (click)="step(1, $event)">
            <i class="pi pi-chevron-right" aria-hidden="true"></i>
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    .viewer {
      position: fixed;
      inset: 0;
      z-index: 1200;
      display: flex;
      flex-direction: column;
      background: color-mix(in srgb, #000 86%, transparent);
      color: #fff;
    }

    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px 8px 20px;

      ::ng-deep .p-button {
        color: #fff;
      }
    }

    .name {
      flex: 1;
      overflow: hidden;
      font-size: 14px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .count {
      font-size: 13px;
      opacity: 0.8;
    }

    .stage {
      position: relative;
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: center;
      min-height: 0;
      padding: 8px 64px 24px;
    }

    .picture {
      width: 100%;
      height: 100%;

      ::ng-deep img {
        object-fit: contain;
      }
    }

    .nav {
      position: absolute;
      top: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      margin-top: -22px;
      border: 0;
      border-radius: 50%;
      background: color-mix(in srgb, #fff 16%, transparent);
      color: #fff;

      &:hover {
        background: color-mix(in srgb, #fff 26%, transparent);
      }

      &.prev { left: 12px; }
      &.next { right: 12px; }
    }

    @media (max-width: 575.98px) {
      .stage {
        padding: 8px 8px 16px;
      }
    }
  `
})
export class ImageViewerComponent implements OnInit, OnDestroy {
  private readonly files = inject(AttachmentFilesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly images = input.required<ChatAttachment[]>();
  readonly start = input<ChatAttachment | null>(null);

  readonly close = output<void>();

  private readonly offset = signal(0);

  readonly index = computed(() => {
    const images = this.images();
    const first = Math.max(images.findIndex(x => x.id === this.start()?.id), 0);
    return ((first + this.offset()) % images.length + images.length) % images.length;
  });

  readonly current = computed(() => this.images()[this.index()]);

  /**
   * Moved to <body>: the glass of the page (backdrop-filter) would otherwise keep the fixed viewer inside it.
   */
  ngOnInit(): void {
    document.body.appendChild(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.host.nativeElement.remove();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close.emit();
    } else if (event.key === 'ArrowLeft') {
      this.offset.update(x => x - 1);
    } else if (event.key === 'ArrowRight') {
      this.offset.update(x => x + 1);
    }
  }

  step(delta: number, event: Event): void {
    event.stopPropagation();
    this.offset.update(x => x + delta);
  }

  download(): void {
    void this.files.download(this.current());
  }
}
