import {inject, Injectable} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {NotificationService} from '../../../../shared/services/notification.service';
import {MessengerApiService} from './messenger-api.service';
import {ChatAttachment} from '../models/messenger.models';

const CACHED_PREVIEWS = 150;

/**
 * Files of the chats need the token, so they are fetched as blobs. Previews of images are kept
 * as object URLs for a while, so scrolling and reopening a chat doesn't load them again.
 */
@Injectable({providedIn: 'root'})
export class AttachmentFilesService {
  private readonly api = inject(MessengerApiService);
  private readonly toast = inject(NotificationService);

  private readonly previews = new Map<number, Promise<string>>();

  /** Object URL of the image. */
  preview(attachment: ChatAttachment): Promise<string> {
    let url = this.previews.get(attachment.id);
    if (url) {
      // The most recently used ones are kept.
      this.previews.delete(attachment.id);
      this.previews.set(attachment.id, url);
      return url;
    }

    url = firstValueFrom(this.api.getAttachment(attachment.id)).then(blob => URL.createObjectURL(blob));
    url.catch(() => this.previews.delete(attachment.id));
    this.previews.set(attachment.id, url);
    this.trim();
    return url;
  }

  /** Saves the file under its name. */
  async download(attachment: ChatAttachment): Promise<void> {
    try {
      const blob = await firstValueFrom(this.api.getAttachment(attachment.id, true));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      this.toast.error('Не вдалося завантажити файл');
    }
  }

  /** PDF and images open in a new tab, the rest is downloaded. */
  async open(attachment: ChatAttachment): Promise<void> {
    const viewable = attachment.isImage || attachment.contentType === 'application/pdf';
    if (!viewable) {
      return this.download(attachment);
    }

    // Opened right away, so the browser doesn't treat it as a popup.
    const tab = window.open('', '_blank');
    try {
      const blob = await firstValueFrom(this.api.getAttachment(attachment.id));
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      tab?.close();
      this.toast.error('Не вдалося відкрити файл');
    }
  }

  private trim(): void {
    while (this.previews.size > CACHED_PREVIEWS) {
      const [id, url] = this.previews.entries().next().value as [number, Promise<string>];
      this.previews.delete(id);
      void url.then((value: string) => URL.revokeObjectURL(value), () => undefined);
    }
  }
}
