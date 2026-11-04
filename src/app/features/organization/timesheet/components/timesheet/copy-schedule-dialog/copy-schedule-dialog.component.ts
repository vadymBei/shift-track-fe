import {Component, computed, effect, inject, OnDestroy, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {catchError, finalize, forkJoin, map, of, Subject, switchMap, takeUntil} from 'rxjs';
import {addDays, addMonths, differenceInCalendarDays, eachDayOfInterval, endOfMonth, format, isAfter, isBefore, isSameDay, isSameMonth, startOfDay, startOfISOWeek, startOfMonth, subDays, subMonths} from 'date-fns';
import {daysInclusive, toApiDate, toApiMonth} from '../../../../../../shared/utils/date.utils';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Button} from 'primeng/button';
import {DatePicker} from 'primeng/datepicker';
import {SelectButton} from 'primeng/selectbutton';
import {Checkbox} from 'primeng/checkbox';
import {Skeleton} from 'primeng/skeleton';
import {NotificationService} from '../../../../../../shared/services/notification.service';
import {Employee} from '../../../../employees/models/employee.model';
import {Shift} from '../../../models/shift.model';
import {Timesheet} from '../../../models/timesheet-model';
import {CreateEmployeeShiftRequest} from '../../../models/create-employee-shift-request.model';
import {TimesheetService} from '../../../services/timesheet-service';
import {EmployeeShiftService} from '../../../services/employee-shift-service';
import {pluralUk} from '../../../../../../shared/utils/text.utils';
import {ShiftChipComponent} from '../../shift-chip/shift-chip.component';

export interface CopyScheduleDialogData {
  departmentId: number;
  month: Date;
  employees: Employee[];
  onlySelected: boolean;
  existing: Record<string, number>;
}

type Preset = 'week' | 'month' | 'custom';

const KEY = (employeeId: number, date: string) => `${employeeId}|${date}`;

/** Inclusive range of whole days. */
interface DayRange {
  from: Date;
  to: Date;
}

@Component({
  selector: 'app-copy-schedule-dialog',
  standalone: true,
  imports: [ShiftChipComponent, FormsModule, Button, DatePicker, SelectButton, Checkbox, Skeleton],
  templateUrl: './copy-schedule-dialog.component.html',
  styleUrl: './copy-schedule-dialog.component.scss'
})
export class CopyScheduleDialogComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly timesheetService = inject(TimesheetService);
  private readonly employeeShiftService = inject(EmployeeShiftService);
  private readonly notifications = inject(NotificationService);
  private readonly data = inject<DynamicDialogConfig<CopyScheduleDialogData>>(DynamicDialogConfig).data!;
  private readonly sourceRequest$ = new Subject<DayRange>();

  readonly employees = this.data.employees;
  readonly onlySelected = this.data.onlySelected;

  readonly monthStart = startOfMonth(this.data.month);
  readonly monthEnd = startOfDay(endOfMonth(this.data.month));
  readonly monthStartDate = this.monthStart;
  readonly monthEndDate = this.monthEnd;
  readonly monthLabel = format(this.monthStart, 'LLLL yyyy');

  readonly presets = [
    {label: 'Минулий тиждень', value: 'week' as Preset},
    {label: 'Минулий місяць', value: 'month' as Preset},
    {label: 'Власний період', value: 'custom' as Preset}
  ];
  readonly preset = signal<Preset>('week');

  readonly source = signal<Date[] | null>(null);
  readonly target = signal<Date[] | null>(null);
  readonly overwrite = signal(false);

  readonly sourceLoading = signal(false);
  readonly sourceShifts = signal<Map<string, Shift>>(new Map());
  readonly isSaving = signal(false);

  readonly sourceRange = computed(() => this.toRange(this.source()));
  readonly targetRange = computed(() => this.toRange(this.target()));
  readonly cycleLength = computed(() => {
    const s = this.sourceRange();
    return s ? daysInclusive(s.from, s.to) : 0;
  });

  readonly error = computed(() => {
    const s = this.sourceRange();
    const t = this.targetRange();
    if (!s || !t) return 'Оберіть період-джерело і куди вставити';
    if (this.cycleLength() > 62) return 'Джерело — не довше 62 днів';
    if (!isBefore(s.to, t.from)) return 'Джерело має закінчуватися раніше, ніж починається вставка';
    return null;
  });

  readonly plan = computed(() => {
    const s = this.sourceRange();
    const t = this.targetRange();
    const empty = {requests: [] as CreateEmployeeShiftRequest[], skippedFilled: 0, sourceFilled: 0, employeesWithSource: 0};
    if (!s || !t || this.error() || this.sourceLoading()) return empty;

    const length = this.cycleLength();
    const shifts = this.sourceShifts();
    const existing = this.data.existing;
    const result = {...empty, requests: [] as CreateEmployeeShiftRequest[]};

    for (const employee of this.employees) {
      let hasSource = false;
      for (const day of eachDayOfInterval({start: s.from, end: s.to})) {
        if (shifts.has(KEY(employee.id, toApiDate(day)))) { hasSource = true; result.sourceFilled++; }
      }
      if (hasSource) result.employeesWithSource++;

      for (const day of eachDayOfInterval({start: t.from, end: t.to})) {
        const offset = ((differenceInCalendarDays(day, s.from) % length) + length) % length;
        const sourceDate = toApiDate(addDays(s.from, offset));
        const shift = shifts.get(KEY(employee.id, sourceDate));
        if (!shift) continue;

        const date = toApiDate(day);
        const current = existing[KEY(employee.id, date)];
        if (current === shift.id) continue;
        if (current && !this.overwrite()) { result.skippedFilled++; continue; }
        result.requests.push({employeeId: employee.id, shiftId: shift.id, date});
      }
    }
    return result;
  });

  readonly preview = computed(() => {
    const s = this.sourceRange();
    if (!s || this.cycleLength() > 31) return [];
    const shifts = this.sourceShifts();
    return this.employees.slice(0, 4).map(employee => {
      const days: {date: string; weekday: string; shift: Shift | null}[] = [];
      for (const day of eachDayOfInterval({start: s.from, end: s.to})) {
        days.push({date: format(day, 'd'), weekday: format(day, 'EEEEEE'), shift: shifts.get(KEY(employee.id, toApiDate(day))) ?? null});
      }
      return {employee, days};
    });
  });

  readonly saveLabel = computed(() => {
    const n = this.plan().requests.length;
    return n ? `Скопіювати · ${n} ${this.plural(n, 'клітинка', 'клітинки', 'клітинок')}` : 'Скопіювати';
  });

  constructor() {
    this.applyPreset('week');

    this.sourceRequest$
      .pipe(
        switchMap(({from, to}) => {
          const months: string[] = [];
          for (let m = startOfMonth(from); !isAfter(m, to); m = addMonths(m, 1)) {
            months.push(toApiMonth(m));
          }
          this.sourceLoading.set(true);
          return forkJoin(months.map(period => this.timesheetService
            .getTimesheet({departmentId: this.data.departmentId, period: period as unknown as Date})
            .pipe(catchError(() => of(null as Timesheet | null)))))
            .pipe(
              map(sheets => {
                const result = new Map<string, Shift>();
                for (const sheet of sheets) {
                  for (const t of sheet?.employeeTimesheets ?? []) {
                    for (const es of t.employeeShifts) {
                      if (es?.shift && es.date) result.set(KEY(t.employee.id, toApiDate(es.date)), es.shift);
                    }
                  }
                }
                return result;
              }),
              finalize(() => this.sourceLoading.set(false))
            );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(result => this.sourceShifts.set(result));

    effect(() => {
      const s = this.sourceRange();
      if (s && this.cycleLength() <= 62) {
        this.sourceRequest$.next(s);
      }
    }, {allowSignalWrites: true});
  }

  applyPreset(preset: Preset): void {
    this.preset.set(preset);
    if (preset === 'custom') return;

    const today = startOfDay(new Date());
    const targetFrom = isSameMonth(this.monthStart, today) ? today : this.monthStart;
    this.target.set([targetFrom, this.monthEnd]);

    if (preset === 'week') {
      const weekStart = subDays(startOfISOWeek(targetFrom), 7);
      this.source.set([weekStart, addDays(weekStart, 6)]);
    } else {
      const prev = subMonths(this.monthStart, 1);
      this.source.set([prev, startOfDay(endOfMonth(prev))]);
      this.target.set([this.monthStart, this.monthEnd]);
    }
  }

  onSourceChange(value: Date[] | null): void {
    this.preset.set('custom');
    this.source.set(value);
  }

  onTargetChange(value: Date[] | null): void {
    this.preset.set('custom');
    this.target.set(value);
  }

  formatRange(range: DayRange | null): string {
    if (!range) return '—';
    const f = (date: Date) => format(date, 'd MMM');
    return isSameDay(range.from, range.to) ? f(range.from) : `${f(range.from)} – ${f(range.to)}`;
  }

  save(): void {
    const requests = this.plan().requests;
    if (!requests.length || this.isSaving()) return;

    this.isSaving.set(true);
    this.employeeShiftService.createEmployeeShifts(requests)
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success(`Графік скопійовано: ${requests.length} ${this.plural(requests.length, 'клітинка', 'клітинки', 'клітинок')}`);
        this.ref.close(true);
      });
  }

  close(): void {
    this.ref.close(false);
  }

  readonly plural = pluralUk;

  private toRange(value: Date[] | null): DayRange | null {
    const from = value?.[0];
    const to = value?.[1] ?? from;
    if (!from || !to) return null;
    return {from: startOfDay(from), to: startOfDay(to)};
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
