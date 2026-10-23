import moment from 'moment';
import {BusinessTripStatus} from '../enums/business-trip-status.enum';
import {BusinessTrip} from '../models/business-trip.model';
import {Employee} from '../../../organization/employees/models/employee.model';
import {personInitials} from '../../../../shared/utils/text.utils';

export type TripTagSeverity = 'success' | 'warn' | 'danger' | 'secondary';

export const BUSINESS_TRIP_STATUS_META: Record<BusinessTripStatus, {label: string; severity: TripTagSeverity}> = {
  [BusinessTripStatus.None]: {label: 'Невідомо', severity: 'secondary'},
  [BusinessTripStatus.PendingApproval]: {label: 'Очікує підтвердження', severity: 'warn'},
  [BusinessTripStatus.Approved]: {label: 'Підтверджено', severity: 'success'},
  [BusinessTripStatus.Rejected]: {label: 'Відхилено', severity: 'danger'}
};

export function isTripClosed(status: BusinessTripStatus): boolean {
  return status === BusinessTripStatus.Approved || status === BusinessTripStatus.Rejected;
}

export function tripRoute(trip: BusinessTrip): string {
  const locations = trip.locations ?? [];
  if (!locations.length) return 'Маршрут не вказано';
  if (locations.length === 1) return locations[0].name;
  return `${locations[0].name} → ${locations[locations.length - 1].name}`;
}

export function tripStops(trip: BusinessTrip): number {
  return Math.max((trip.locations?.length ?? 0) - 2, 0);
}

export function tripDays(trip: BusinessTrip): number {
  return moment(trip.endDate).startOf('day').diff(moment(trip.startDate).startOf('day'), 'days') + 1;
}

export function employeeInitials(employee: Employee): string {
  return personInitials(employee) || '?';
}

export function toTripApiDate(date: Date): Date {
  return new Date(moment(date).format('YYYY-MM-DD'));
}
