import {differenceInCalendarDays, format, parseISO, set, setDefaultOptions} from 'date-fns';
import {uk} from 'date-fns/locale';

/** A date from the API ('2026-10-27', '2026-10-27T10:00:00', '...Z') or a Date. */
export type DateInput = Date | string | number;

/** Ukrainian month and weekday names and weeks from Monday for every date-fns call. Called once in main.ts. */
export function configureDates(): void {
  setDefaultOptions({locale: uk, weekStartsOn: 1});
}

/**
 * Converts to a Date. Strings are parsed as ISO, so a date without time is the local midnight
 * (`new Date('2026-10-27')` would be the UTC midnight and could shift the day).
 */
export function toDate(value: DateInput): Date {
  return typeof value === 'string' ? parseISO(value) : new Date(value);
}

/** Formats with date-fns tokens ('dd.MM.yyyy', 'd MMMM', 'EEEEEE') in the default locale. */
export function formatDate(value: DateInput, pattern: string): string {
  return format(toDate(value), pattern);
}

/** Date for the API: 2026-10-27. */
export function toApiDate(value: DateInput): string {
  return format(toDate(value), 'yyyy-MM-dd');
}

/** Month for the API: 2026-10. */
export function toApiMonth(value: DateInput): string {
  return format(toDate(value), 'yyyy-MM');
}

/** The day at a time of day like '08:00:00'. */
export function atTime(day: Date, time: string): Date {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);
  return set(day, {hours, minutes, seconds, milliseconds: 0});
}

/** Calendar days from start to end inclusive: the same day is 1. */
export function daysInclusive(start: DateInput, end: DateInput): number {
  return differenceInCalendarDays(toDate(end), toDate(start)) + 1;
}
