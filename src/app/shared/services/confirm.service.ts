import {inject, Injectable} from '@angular/core';
import {ConfirmationService} from 'primeng/api';

export interface ConfirmDeleteOptions {
  entityName: string;
  itemName?: string;
  onConfirm: () => void;
}

export interface ConfirmOptions {
  header: string;
  message: string;
  acceptLabel: string;
  acceptSeverity?: 'primary' | 'success' | 'danger' | 'warn';
  icon?: string;
  onConfirm: () => void;
}

@Injectable({providedIn: 'root'})
export class ConfirmService {
  private confirmationService = inject(ConfirmationService);

  confirm({header, message, acceptLabel, acceptSeverity = 'primary', icon, onConfirm}: ConfirmOptions): void {
    this.confirmationService.confirm({
      header,
      message,
      icon,
      acceptLabel,
      rejectLabel: 'Скасувати',
      acceptButtonProps: {severity: acceptSeverity},
      rejectButtonProps: {severity: 'secondary', text: true},
      defaultFocus: 'reject',
      closeOnEscape: true,
      dismissableMask: true,
      accept: onConfirm
    });
  }

  confirmDelete({entityName, itemName, onConfirm}: ConfirmDeleteOptions): void {
    const target = itemName ? `${entityName} «${itemName}»` : entityName;

    this.confirmationService.confirm({
      header: 'Підтвердження видалення',
      message: `Ви впевнені, що хочете видалити ${target}? Цю дію не можна скасувати.`,
      icon: 'pi pi-trash',
      acceptLabel: 'Видалити',
      rejectLabel: 'Скасувати',
      acceptButtonProps: {severity: 'danger', icon: 'pi pi-trash'},
      rejectButtonProps: {severity: 'secondary', text: true},
      defaultFocus: 'reject',
      closeOnEscape: true,
      dismissableMask: true,
      accept: onConfirm
    });
  }
}
