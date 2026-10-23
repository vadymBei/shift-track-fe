import {Component, computed, effect, inject, input, OnDestroy, output, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {Subscription} from 'rxjs';
import {Avatar} from 'primeng/avatar';
import {Button} from 'primeng/button';
import {Tooltip} from 'primeng/tooltip';
import {Divider} from 'primeng/divider';
import {AccountService} from '../../../../../core/account/services/account.service';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {Employee} from '../../models/employee.model';
import {personInitials} from '../../../../../shared/utils/text.utils';

@Component({
  selector: 'app-contact-details',
  standalone: true,
  imports: [DatePipe, Avatar, Button, Tooltip, Divider],
  templateUrl: './contact-details.component.html',
  styleUrl: './contact-details.component.scss'
})
export class ContactDetailsComponent implements OnDestroy {
  private readonly accountService = inject(AccountService);
  private readonly notifications = inject(NotificationService);

  employee = input.required<Employee>();
  close = output<void>();

  readonly photoUrl = signal<string | null>(null);
  private photoSub?: Subscription;

  readonly initials = computed(() => personInitials(this.employee()));

  readonly details = computed(() => {
    const e = this.employee();
    return [
      {icon: 'pi pi-id-card', label: 'Посада', value: e.position?.name ?? 'Без посади'},
      {icon: 'pi pi-building', label: 'Департамент', value: e.department?.name ?? 'Не вказано'},
      {icon: 'pi pi-map-marker', label: 'Регіон', value: e.department?.unit?.name ?? 'Не вказано'}
    ];
  });

  constructor() {
    effect(() => {
      const id = this.employee().id;
      this.photoSub?.unsubscribe();
      this.revokePhoto();
      this.photoSub = this.accountService.getProfilePhoto(id).subscribe({
        next: response => {
          if (response.body && response.body.size > 0) {
            this.photoUrl.set(URL.createObjectURL(response.body));
          }
        },
        error: () => this.photoUrl.set(null)
      });
    });
  }

  copy(value: string | undefined, what: string): void {
    if (!value) return;
    navigator.clipboard?.writeText(value)
      .then(() => this.notifications.success(`${what} скопійовано`))
      .catch(() => this.notifications.warn('Не вдалося скопіювати'));
  }

  private revokePhoto(): void {
    const url = this.photoUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.photoUrl.set(null);
    }
  }

  ngOnDestroy(): void {
    this.photoSub?.unsubscribe();
    this.revokePhoto();
  }
}
