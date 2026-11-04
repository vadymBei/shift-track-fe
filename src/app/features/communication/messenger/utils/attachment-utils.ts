import {ChatAttachment} from '../models/messenger.models';

export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

/** As on the server (MessengerConstants.AttachmentTypes). */
export const ATTACHMENT_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.rtf', '.txt', '.csv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.zip', '.rar', '.7z'
];

/** For the file picker. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.join(',');

/** Images the browser shows as a picture (HEIC is downloaded as a file). */
const PREVIEW_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(dot).toLowerCase() : '';
}

/** Why the file can't be sent, or null. */
export function attachmentProblem(file: File): string | null {
  if (!ATTACHMENT_EXTENSIONS.includes(extensionOf(file.name))) {
    return 'Такий тип файлів не можна надіслати';
  }
  if (file.size === 0) {
    return 'Файл порожній';
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return 'Файл більший за 20 МБ';
  }
  return null;
}

export function hasPreview(attachment: ChatAttachment): boolean {
  return PREVIEW_TYPES.includes(attachment.contentType);
}

/** 840 Б, 12 КБ, 3,4 МБ. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} КБ`;
  }
  return `${(bytes / 1024 / 1024).toLocaleString('uk-UA', {maximumFractionDigits: 1})} МБ`;
}

/** A short label and a tone for the file tile. */
export function fileBadge(fileName: string): {label: string; tone: string} {
  const extension = extensionOf(fileName).slice(1);
  const tone = ({
    pdf: 'red', doc: 'blue', docx: 'blue', odt: 'blue', rtf: 'blue', txt: 'gray',
    xls: 'green', xlsx: 'green', ods: 'green', csv: 'green',
    ppt: 'orange', pptx: 'orange', zip: 'gray', rar: 'gray', '7z': 'gray'
  } as Record<string, string>)[extension] ?? 'violet';
  return {label: (extension || 'файл').slice(0, 4).toUpperCase(), tone};
}
