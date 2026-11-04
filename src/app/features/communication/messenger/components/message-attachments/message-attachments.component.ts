import {ChangeDetectionStrategy, Component, computed, inject, input, output} from '@angular/core';
import {Tooltip} from 'primeng/tooltip';
import {AttachmentFilesService} from '../../services/attachment-files.service';
import {ChatAttachment} from '../../models/messenger.models';
import {formatSize, hasPreview} from '../../utils/attachment-utils';
import {AttachmentImageComponent} from '../attachment-image/attachment-image.component';
import {FileBadgeComponent} from '../file-badge/file-badge.component';

/** Pictures of a message as a grid, other files as tiles to open or download. */
@Component({
  selector: 'app-message-attachments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Tooltip, AttachmentImageComponent, FileBadgeComponent],
  templateUrl: './message-attachments.component.html',
  styleUrl: './message-attachments.component.scss'
})
export class MessageAttachmentsComponent {
  private readonly files = inject(AttachmentFilesService);

  readonly attachments = input.required<ChatAttachment[]>();

  readonly viewImage = output<ChatAttachment>();

  readonly images = computed(() => this.attachments().filter(hasPreview));
  readonly documents = computed(() => this.attachments().filter(x => !hasPreview(x)));

  open(attachment: ChatAttachment): void {
    void this.files.open(attachment);
  }

  download(attachment: ChatAttachment): void {
    void this.files.download(attachment);
  }

  size(bytes: number): string {
    return formatSize(bytes);
  }
}
