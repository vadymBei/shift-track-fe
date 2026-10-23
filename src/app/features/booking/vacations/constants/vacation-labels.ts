import moment from 'moment';
import {VacationType} from '../enums/vacation-type.enum';
import {VacationStatus} from '../enums/vacation-status.enum';
import {pluralUk} from '../../../../shared/utils/text.utils';

export type TagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export const VACATION_TYPE_LABELS: Record<VacationType, string> = {
  [VacationType.None]: 'Відпустка',
  [VacationType.YearMainVacation]: 'Основна щорічна відпустка',
  [VacationType.BonusVacation]: 'Бонусна відпустка',
  [VacationType.VacationWithoutSalaryByFamily]: 'Без збереження з/п за сімейними обставинами',
  [VacationType.VacationWithoutSalaryByPregnancy]: "У зв'язку з вагітністю та пологами",
  [VacationType.VacationWithoutSalaryByChild3years]: 'Догляд за дитиною до 3 років',
  [VacationType.VacationWithoutSalaryByChild6years]: 'Догляд за дитиною до 6 років'
};

export const VACATION_TYPE_GROUPS = [
  {
    label: 'Щорічні',
    items: [VacationType.YearMainVacation, VacationType.BonusVacation]
      .map(value => ({label: VACATION_TYPE_LABELS[value], value}))
  },
  {
    label: 'Соціальні та інші',
    items: [
      VacationType.VacationWithoutSalaryByFamily,
      VacationType.VacationWithoutSalaryByPregnancy,
      VacationType.VacationWithoutSalaryByChild3years,
      VacationType.VacationWithoutSalaryByChild6years
    ].map(value => ({label: VACATION_TYPE_LABELS[value], value}))
  }
];

export interface VacationStatusMeta {
  label: string;
  severity: TagSeverity;
}

export const VACATION_STATUS_META: Record<VacationStatus, VacationStatusMeta> = {
  [VacationStatus.None]: {label: 'Чернетка', severity: 'secondary'},
  [VacationStatus.PendingApproval]: {label: 'Очікує погодження', severity: 'warn'},
  [VacationStatus.ApprovedByDepartmentDirector]: {label: 'Погоджено директором', severity: 'info'},
  [VacationStatus.ApprovedByUnitDirector]: {label: 'Погоджено', severity: 'success'},
  [VacationStatus.Rejected]: {label: 'Відхилено', severity: 'danger'}
};

export const VACATION_STATUS_FILTER_OPTIONS = [
  {label: 'Усі', value: VacationStatus.None},
  {label: 'Очікує погодження', value: VacationStatus.PendingApproval},
  {label: 'Погоджено директором', value: VacationStatus.ApprovedByDepartmentDirector},
  {label: 'Погоджено', value: VacationStatus.ApprovedByUnitDirector},
  {label: 'Відхилено', value: VacationStatus.Rejected}
];

export function isFinalStatus(status: VacationStatus): boolean {
  return status === VacationStatus.ApprovedByUnitDirector || status === VacationStatus.Rejected;
}

export function countVacationDays(start?: Date | string | null, end?: Date | string | null): number {
  if (!start || !end) {
    return 0;
  }
  const days = moment(end).startOf('day').diff(moment(start).startOf('day'), 'days') + 1;
  return days > 0 ? days : 0;
}

export function toApiDate(date: Date | string): string {
  return moment(date).format('YYYY-MM-DD');
}

export function pluralDays(count: number): string {
  return `${count} ${pluralUk(count, 'день', 'дні', 'днів')}`;
}
