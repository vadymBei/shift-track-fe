import {effect, inject, Injectable, signal, untracked} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Router} from '@angular/router';
import {AccountService} from '../../account/services/account.service';
import {NotificationService} from '../../../shared/services/notification.service';
import {HomeService} from '../../../features/home/services/home.service';
import {RealtimeService} from '../../realtime/realtime.service';
import {AppNotification} from '../models/app-notification.model';
import {notificationLink} from '../constants/notification-meta';

const LIST_SIZE = 50;

@Injectable({providedIn: 'root'})
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly accountService = inject(AccountService);
  private readonly toast = inject(NotificationService);
  private readonly homeService = inject(HomeService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);

  private readonly path = 'communication/notifications';

  readonly unreadCount = signal(0);
  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);

  private employeeId: number | null = null;

  constructor() {
    this.realtime.on<AppNotification>('notificationReceived', notification => this.onReceived(notification));
    this.realtime.on('notificationsChanged', () => this.onChanged());
    this.realtime.onReconnected(() => this.onChanged());

    effect(() => {
      const employeeId = this.accountService.currentUser()?.employee?.id ?? null;
      untracked(() => this.onUserChanged(employeeId));
    });
  }

  loadList(): void {
    this.loading.set(true);
    this.http.get<AppNotification[]>(this.path, {params: {take: LIST_SIZE}})
      .subscribe({
        next: items => {
          this.items.set(items ?? []);
          this.loaded.set(true);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }

  refreshCount(): void {
    this.http.get<{count: number}>(`${this.path}/unread/count`)
      .subscribe({next: result => this.unreadCount.set(result?.count ?? 0), error: () => undefined});
  }

  markAsRead(notification: AppNotification): void {
    if (notification.readAt) {
      return;
    }
    const readAt = new Date().toISOString();
    this.items.update(items => items.map(n => n.id === notification.id ? {...n, readAt} : n));
    this.unreadCount.update(count => Math.max(count - 1, 0));
    this.http.put(`${this.path}/read/${notification.id}`, {})
      .subscribe({error: () => this.refreshCount()});
  }

  markAllAsRead(): void {
    const readAt = new Date().toISOString();
    this.items.update(items => items.map(n => n.readAt ? n : {...n, readAt}));
    this.unreadCount.set(0);
    this.http.put(`${this.path}/read-all`, {})
      .subscribe({error: () => this.refreshCount()});
  }

  remove(notification: AppNotification): void {
    this.items.update(items => items.filter(n => n.id !== notification.id));
    if (!notification.readAt) {
      this.unreadCount.update(count => Math.max(count - 1, 0));
    }
    this.http.delete(`${this.path}/${notification.id}`)
      .subscribe({error: () => this.refreshCount()});
  }

  private onUserChanged(employeeId: number | null): void {
    if (employeeId === this.employeeId) {
      return;
    }
    this.employeeId = employeeId;
    this.items.set([]);
    this.loaded.set(false);
    this.unreadCount.set(0);

    if (employeeId) {
      this.refreshCount();
    }
  }

  private onReceived(notification: AppNotification): void {
    if (!notification.readAt) {
      this.unreadCount.update(count => count + 1);
    }
    if (this.loaded()) {
      this.items.update(items => [notification, ...items.filter(n => n.id !== notification.id)]);
    }
    // A mention in the chat that is open right now needs no pop-up.
    const openChat = notification.moduleType === 'Messenger'
      && this.router.url.split('?')[0] === `/messages/${notification.entityId}`;
    if (!openChat) {
      const link = notificationLink(notification);
      this.toast.info(notification.message ?? '', notification.title, link ? {
        open: () => {
          this.markAsRead(notification);
          void this.router.navigate([link.path], {queryParams: link.queryParams});
        }
      } : undefined);
    }
    if (notification.moduleType === 'Vacation' || notification.moduleType === 'BusinessTrip') {
      this.homeService.refreshPendingCounts();
    }
  }

  private onChanged(): void {
    this.refreshCount();
    if (this.loaded()) {
      this.loadList();
    }
    this.homeService.refreshPendingCounts();
  }
}
