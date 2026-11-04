import {Component, inject} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {PrimeTemplate, ToastMessageOptions} from 'primeng/api';
import {CheckIcon, ExclamationTriangleIcon, InfoCircleIcon, TimesCircleIcon} from 'primeng/icons';
import {Toast} from 'primeng/toast';
import {ConfirmDialog} from 'primeng/confirmdialog';
import {ThemeService} from './shared/services/theme.service';
import {ToastAction} from './shared/services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    Toast,
    PrimeTemplate,
    ConfirmDialog,
    CheckIcon,
    ExclamationTriangleIcon,
    InfoCircleIcon,
    TimesCircleIcon
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor() {
    inject(ThemeService);
  }

  /** Runs the action of the toast and closes it. */
  open(message: ToastMessageOptions, event: Event): void {
    (message.data?.action as ToastAction | undefined)?.open();
    // PrimeNG has no API to close one toast: its own close button does it.
    (event.currentTarget as HTMLElement).closest('.p-toast-message')
      ?.querySelector<HTMLElement>('.p-toast-close-button')?.click();
  }
}
