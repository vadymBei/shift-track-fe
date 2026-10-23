import {inject, Injectable} from '@angular/core';
import {MessageService} from 'primeng/api';

@Injectable({providedIn: 'root'})
export class NotificationService {
  private messageService = inject(MessageService);

  success(detail: string, summary = 'Готово'): void {
    this.messageService.add({severity: 'success', summary, detail, life: 3000});
  }

  info(detail: string, summary = 'Інформація'): void {
    this.messageService.add({severity: 'info', summary, detail, life: 4000});
  }

  warn(detail: string, summary = 'Увага'): void {
    this.messageService.add({severity: 'warn', summary, detail, life: 5000});
  }

  error(detail: string, summary = 'Помилка'): void {
    this.messageService.add({severity: 'error', summary, detail, life: 5000});
  }
}
