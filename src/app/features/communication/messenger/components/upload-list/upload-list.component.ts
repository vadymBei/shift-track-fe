import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
import {Subscription} from 'rxjs';
import {ChatAttachment} from '../../models/messenger.models';
import {formatSize} from '../../utils/attachment-utils';
import {FileBadgeComponent} from '../file-badge/file-badge.component';

export interface PendingUpload {
  key: number;
  name: string;
  size: number;
  progress: number;
  attachment: ChatAttachment | null;
  error: string | null;
  subscription?: Subscription;
}

/** Files chosen for the next message: progress, size or the problem, and a button to drop the file. */
@Component({
  selector: 'app-upload-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileBadgeComponent],
  template: `
    <ul class="uploads" aria-label="Файли до повідомлення">
      @for (upload of uploads(); track upload.key) {
        <li class="upload" [class.failed]="!!upload.error">
          <app-file-badge [fileName]="upload.name"/>
          <span class="text">
            <span class="name">{{ upload.name }}</span>
            @if (upload.error) {
              <span class="meta error">{{ upload.error }}</span>
            } @else if (!upload.attachment) {
              <span class="progress" role="progressbar" [attr.aria-valuenow]="upload.progress" aria-valuemin="0"
                    aria-valuemax="100" [attr.aria-label]="'Завантаження ' + upload.name">
                <span [style.width.%]="upload.progress"></span>
              </span>
            } @else {
              <span class="meta">{{ size(upload.size) }}</span>
            }
          </span>
          <button type="button" class="remove" [attr.aria-label]="'Прибрати ' + upload.name" (click)="remove.emit(upload)">
            <i class="pi pi-times" aria-hidden="true"></i>
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }

    .uploads {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .upload {
      display: flex;
      flex: 0 1 240px;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 4px 4px 4px 6px;
      border-radius: 12px;
      background: var(--p-content-hover-background);
      color: var(--p-text-color);

      &.failed {
        background: color-mix(in srgb, var(--p-red-500) 10%, transparent);
      }
    }

    .text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .name {
      overflow: hidden;
      font-size: 13px;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta {
      font-size: 11px;
      color: var(--p-text-muted-color);

      &.error {
        color: var(--p-red-500);
      }
    }

    .progress {
      display: block;
      height: 4px;
      margin-top: 4px;
      overflow: hidden;
      border-radius: 2px;
      background: var(--p-content-border-color);

      span {
        display: block;
        height: 100%;
        background: var(--p-primary-color);
        transition: width 0.2s ease-out;
      }
    }

    .remove {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--p-text-muted-color);

      &:hover {
        background: var(--p-content-border-color);
        color: var(--p-text-color);
      }

      &:focus-visible {
        outline: 2px solid var(--p-primary-color);
      }
    }

  `
})
export class UploadListComponent {
  readonly uploads = input.required<PendingUpload[]>();

  readonly remove = output<PendingUpload>();

  size(bytes: number): string {
    return formatSize(bytes);
  }
}
