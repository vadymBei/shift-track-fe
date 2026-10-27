import {AppNotification, NotificationType} from '../models/app-notification.model';

export type NotificationTone = 'violet' | 'green' | 'red' | 'blue' | 'amber' | 'teal' | 'pink' | 'grey';

export interface NotificationMeta {
  icon: string;
  tone: NotificationTone;
}

const FALLBACK: NotificationMeta = {icon: 'pi-bell', tone: 'grey'};

export const NOTIFICATION_META: Partial<Record<NotificationType, NotificationMeta>> = {
  VacationPendingApproval: {icon: 'pi-inbox', tone: 'violet'},
  VacationApproved: {icon: 'pi-check', tone: 'blue'},
  VacationFinallyApproved: {icon: 'pi-check-circle', tone: 'green'},
  VacationRejected: {icon: 'pi-times-circle', tone: 'red'},
  VacationCreatedForYou: {icon: 'pi-sun', tone: 'violet'},
  VacationDeleted: {icon: 'pi-trash', tone: 'grey'},
  BusinessTripPendingApproval: {icon: 'pi-briefcase', tone: 'violet'},
  BusinessTripAdded: {icon: 'pi-briefcase', tone: 'blue'},
  BusinessTripApproved: {icon: 'pi-check-circle', tone: 'green'},
  BusinessTripRejected: {icon: 'pi-times-circle', tone: 'red'},
  BusinessTripChanged: {icon: 'pi-calendar', tone: 'amber'},
  BusinessTripRemoved: {icon: 'pi-ban', tone: 'grey'},
  ShiftChanged: {icon: 'pi-calendar', tone: 'blue'},
  ScheduleUpdated: {icon: 'pi-megaphone', tone: 'teal'},
  PayrollPaid: {icon: 'pi-wallet', tone: 'amber'},
  RoleChanged: {icon: 'pi-shield', tone: 'violet'},
  EmployeeRegistered: {icon: 'pi-user-plus', tone: 'teal'},
  Mention: {icon: 'pi-at', tone: 'pink'}
};

export function notificationMeta(notification: AppNotification): NotificationMeta {
  return NOTIFICATION_META[notification.type] ?? FALLBACK;
}

const NO_LINK: NotificationType[] = ['VacationDeleted', 'BusinessTripRemoved'];

export function notificationLink(notification: AppNotification): {path: string; queryParams?: Record<string, number>} | null {
  if (NO_LINK.includes(notification.type)) {
    return null;
  }

  switch (notification.moduleType) {
    case 'Vacation':
      return notification.entityId ? {path: '/vacations', queryParams: {open: notification.entityId}} : {path: '/vacations'};
    case 'BusinessTrip':
      return notification.entityId ? {path: '/business-trips', queryParams: {open: notification.entityId}} : {path: '/business-trips'};
    case 'Timesheet':
      return {path: '/timesheet'};
    case 'Payroll':
      return {path: '/payrolls'};
    default:
      return null;
  }
}
