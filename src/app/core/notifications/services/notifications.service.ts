import {effect, inject, Injectable, signal, untracked} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {HttpTransportType, HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel} from '@microsoft/signalr';
import {AccountService} from '../../account/services/account.service';
import {NotificationService} from '../../../shared/services/notification.service';
import {HomeService} from '../../../features/home/services/home.service';
import {NOTIFICATIONS_HUB_URL} from '../../../shared/constants/api.constants';
import {AppNotification} from '../models/app-notification.model';

const RESTART_DELAY_MS = 30_000;
const LIST_SIZE = 50;

@Injectable({providedIn: 'root'})
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly accountService = inject(AccountService);
  private readonly toast = inject(NotificationService);
  private readonly homeService = inject(HomeService);

  private readonly path = 'communication/notifications';

  readonly unreadCount = signal(0);
  readonly items = signal<AppNotification[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);

  private employeeId: number | null = null;
  private connection: HubConnection | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
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
    void this.stopConnection();

    if (employeeId) {
      this.refreshCount();
      void this.startConnection();
    }
  }

  private async startConnection(): Promise<void> {
    this.clearRestart();

    const connection = new HubConnectionBuilder()
      .withUrl(NOTIFICATIONS_HUB_URL, {
        accessTokenFactory: () => this.accountService.token()?.accessToken ?? '',
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('notificationReceived', (notification: AppNotification) => this.onReceived(notification));
    connection.on('notificationsChanged', () => this.onChanged());
    connection.onreconnected(() => this.onChanged());
    connection.onclose(() => this.scheduleRestart(connection));

    this.connection = connection;

    try {
      await connection.start();
    } catch {
      this.scheduleRestart(connection);
    }
  }

  private async stopConnection(): Promise<void> {
    this.clearRestart();
    const connection = this.connection;
    this.connection = null;
    if (connection && connection.state !== HubConnectionState.Disconnected) {
      await connection.stop().catch(() => undefined);
    }
  }

  private scheduleRestart(connection: HubConnection): void {
    if (connection !== this.connection || !this.employeeId) {
      return;
    }
    this.clearRestart();
    this.restartTimer = setTimeout(() => {
      if (connection === this.connection && connection.state === HubConnectionState.Disconnected) {
        connection.start().catch(() => this.scheduleRestart(connection));
      }
    }, RESTART_DELAY_MS);
  }

  private clearRestart(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private onReceived(notification: AppNotification): void {
    if (!notification.readAt) {
      this.unreadCount.update(count => count + 1);
    }
    if (this.loaded()) {
      this.items.update(items => [notification, ...items.filter(n => n.id !== notification.id)]);
    }
    this.toast.info(notification.message ?? '', notification.title);
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
