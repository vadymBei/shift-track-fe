import {Component, computed, inject, signal, viewChild} from '@angular/core';
import {Router} from '@angular/router';
import moment from 'moment';
import 'moment/locale/uk';
import {Popover} from 'primeng/popover';
import {Skeleton} from 'primeng/skeleton';
import {Tooltip} from 'primeng/tooltip';
import {NotificationsService} from '../../services/notifications.service';
import {AppNotification} from '../../models/app-notification.model';
import {notificationLink, notificationMeta} from '../../constants/notification-meta';

type NotificationsTab = 'all' | 'unread';

interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [Popover, Skeleton, Tooltip],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss'
})
export class NotificationBellComponent {
  private readonly notificationsService = inject(NotificationsService);
  private readonly router = inject(Router);

  private readonly panel = viewChild.required<Popover>('panel');

  readonly unreadCount = this.notificationsService.unreadCount;
  readonly loading = this.notificationsService.loading;
  readonly tab = signal<NotificationsTab>('all');

  readonly badge = computed(() => {
    const count = this.unreadCount();
    return count > 99 ? '99+' : String(count);
  });

  readonly ariaLabel = computed(() => this.unreadCount()
    ? `Сповіщення, непрочитаних: ${this.unreadCount()}`
    : 'Сповіщення');

  readonly groups = computed<NotificationGroup[]>(() => {
    const items = this.tab() === 'unread'
      ? this.notificationsService.items().filter(n => !n.readAt)
      : this.notificationsService.items();

    const today = moment().startOf('day');
    const todayItems = items.filter(n => moment(n.createdAt).isSameOrAfter(today));
    const earlierItems = items.filter(n => moment(n.createdAt).isBefore(today));

    return [
      {label: 'Сьогодні', items: todayItems},
      {label: 'Раніше', items: earlierItems}
    ].filter(group => group.items.length);
  });

  readonly isInitialLoading = computed(() => this.loading() && !this.notificationsService.loaded());

  readonly meta = notificationMeta;

  toggle(event: Event): void {
    const panel = this.panel();
    const opening = !panel.overlayVisible;
    panel.toggle(event);
    if (opening) {
      this.notificationsService.loadList();
    }
  }

  open(notification: AppNotification): void {
    this.notificationsService.markAsRead(notification);
    const link = notificationLink(notification);
    if (link) {
      this.panel().hide();
      this.router.navigate([link.path], {queryParams: link.queryParams});
    }
  }

  remove(notification: AppNotification, event: Event): void {
    event.stopPropagation();
    this.notificationsService.remove(notification);
  }

  markAllAsRead(): void {
    this.notificationsService.markAllAsRead();
  }

  time(notification: AppNotification): string {
    const value = moment(notification.createdAt).locale('uk');
    if (moment().diff(value, 'hours') < 12) {
      return value.fromNow();
    }
    return value.isSame(moment(), 'year') ? value.format('D MMM, HH:mm') : value.format('D MMM YYYY');
  }

  showAuthor(notification: AppNotification): boolean {
    const author = notification.authorFullName;
    return !!author && !(notification.message ?? '').includes(author);
  }

  hasLink(notification: AppNotification): boolean {
    return notificationLink(notification) !== null;
  }
}
