import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';

/** A toast that opens something when clicked (a chat, a vacation). */
export interface ToastAction {
  open: () => void;
}

@Injectable({providedIn: 'root'})
export class NotificationService {
  private messageService = inject(MessageService);

  success(detail: string, summary = 'Готово'): void {
    this.messageService.add({severity: 'success', summary, detail, life: 3000});
  }

  info(detail: string, summary = 'Інформація', action?: ToastAction): void {
    this.messageService.add({severity: 'info', summary, detail, life: action ? 6000 : 4000, data: action ? {action} : undefined});
  }

  warn(detail: string, summary = 'Увага'): void {
    this.messageService.add({severity: 'warn', summary, detail, life: 5000});
  }

  error(detail: string, summary = 'Помилка'): void {
    this.messageService.add({severity: 'error', summary, detail, life: 5000});
  }
}
