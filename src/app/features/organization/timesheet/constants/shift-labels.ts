import {ShiftType} from '../enums/shift-type.enum';
import {Shift} from '../models/shift.model';

export const SHIFT_TYPE_META: Record<ShiftType, {label: string; icon: string; severity: 'info' | 'success' | 'warn' | 'secondary' | 'contrast'}> = {
  [ShiftType.workday]: {label: 'Робоча зміна', icon: 'pi pi-briefcase', severity: 'info'},
  [ShiftType.vacation]: {label: 'Відпустка', icon: 'pi pi-sun', severity: 'success'},
  [ShiftType.dayOff]: {label: 'Вихідний', icon: 'pi pi-home', severity: 'secondary'},
  [ShiftType.holiday]: {label: 'Свято', icon: 'pi pi-star', severity: 'warn'},
  [ShiftType.none]: {label: 'Інше', icon: 'pi pi-circle', severity: 'contrast'}
};

export const SHIFT_TYPE_OPTIONS = [
  ShiftType.workday, ShiftType.vacation, ShiftType.dayOff, ShiftType.holiday, ShiftType.none
].map(value => ({value, ...SHIFT_TYPE_META[value]}));

export const SHIFT_COLORS = [
  '#E57373', '#F06292', '#B66AC5', '#9675CE', '#7986CC',
  '#64B5F6', '#4FC2F8', '#4DD0E2', '#4CB6AC', '#80C783',
  '#AED584', '#DDE776', '#FFF176', '#FFD54D', '#FFB64D',
  '#FF8B66', '#A08780', '#E0E0E0', '#90A4AD', '#FFFFFF'
];

export function readableTextColor(hex: string | null | undefined): string {
  const value = (hex ?? '').replace('#', '');
  if (value.length !== 6) return '#1d1830';
  const [r, g, b] = [0, 2, 4].map(i => parseInt(value.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1d1830' : '#ffffff';
}

export function shortTime(time: string | null | undefined): string {
  return time ? time.slice(0, 5) : '';
}

export function shiftMinutes(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  let diff = toMin(end) - toMin(start);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} год ${m} хв` : `${h} год`;
}

export function isOvernight(shift: Pick<Shift, 'startTime' | 'endTime'>): boolean {
  return !!shift.startTime && !!shift.endTime && shift.endTime.slice(0, 5) <= shift.startTime.slice(0, 5);
}
