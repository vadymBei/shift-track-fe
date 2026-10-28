import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {finalize, Subject, takeUntil} from 'rxjs';
import {eachDayOfInterval, format, isSameDay, startOfDay} from 'date-fns';
import {daysInclusive, toApiDate} from '../../../../../../shared/utils/date.utils';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Button} from 'primeng/button';
import {DatePicker} from 'primeng/datepicker';
import {SelectButton} from 'primeng/selectbutton';
import {Avatar} from 'primeng/avatar';
import {Skeleton} from 'primeng/skeleton';
import {NotificationService} from '../../../../../../shared/services/notification.service';
import {Employee} from '../../../../employees/models/employee.model';
import {EmployeeShift} from '../../../models/employee-shift.model';
import {EmployeeShiftHistory} from '../../../models/employee-shift-history.model';
import {Shift} from '../../../models/shift.model';
import {ShiftType} from '../../../enums/shift-type.enum';
import {CreateEmployeeShiftRequest} from '../../../models/create-employee-shift-request.model';
import {EmployeeShiftService} from '../../../services/employee-shift-service';
import {EmployeeShiftHistoryService} from '../../../services/employee-shift-history-service';
import {shortTime, SHIFT_TYPE_META} from '../../../constants/shift-labels';
import {personInitials} from '../../../../../../shared/utils/text.utils';
import {ShiftChipComponent} from '../../shift-chip/shift-chip.component';

export interface EmployeeShiftDialogData {
  employees: Employee[];
  dateFrom: Date;
  dateTo: Date;
  employeeShift?: EmployeeShift;
  shifts: Shift[];
  occupied?: string[];
}

type Tab = 'assign' | 'history';

@Component({
  selector: 'app-employee-shift-dialog',
  standalone: true,
  imports: [ShiftChipComponent, DatePipe, FormsModule, Button, DatePicker, SelectButton, Avatar, Skeleton],
  templateUrl: './employee-shift-dialog.component.html',
  styleUrl: './employee-shift-dialog.component.scss'
})
export class EmployeeShiftDialogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly employeeShiftService = inject(EmployeeShiftService);
  private readonly historyService = inject(EmployeeShiftHistoryService);
  private readonly notifications = inject(NotificationService);
  private readonly data = inject<DynamicDialogConfig<EmployeeShiftDialogData>>(DynamicDialogConfig).data!;

  readonly employees = this.data.employees;
  readonly employee = this.employees[0];
  readonly isBulk = this.employees.length > 1;
  private readonly occupied = new Set(this.data.occupied ?? []);
  readonly visibleNames = 4;
  readonly hiddenNames = this.employees.slice(this.visibleNames).map(e => e.fullName).join(', ');
  readonly current = this.data.employeeShift;
  readonly shortTime = shortTime;

  readonly tabs = [
    {label: 'Зміна', value: 'assign' as Tab},
    {label: 'Історія', value: 'history' as Tab}
  ];
  readonly tab = signal<Tab>('assign');

  readonly range = signal<Date[] | null>([this.data.dateFrom, this.data.dateTo]);
  readonly shiftId = signal<number | null>(this.current?.shift?.id ?? null);
  readonly isSaving = signal(false);
  readonly history = signal<EmployeeShiftHistory[]>([]);
  readonly historyLoading = signal(false);

  readonly initials = (e: Employee | undefined): string => personInitials(e);

  readonly groups = (() => {
    const order = [ShiftType.workday, ShiftType.dayOff, ShiftType.vacation, ShiftType.holiday, ShiftType.none];
    return order
      .map(type => ({
        type,
        label: type === ShiftType.workday ? 'Робочі зміни' : SHIFT_TYPE_META[type].label,
        icon: SHIFT_TYPE_META[type].icon,
        shifts: this.data.shifts
          .filter(s => (s.type ?? ShiftType.none) === type)
          .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.code.localeCompare(b.code, 'uk'))
      }))
      .filter(g => g.shifts.length);
  })();

  readonly selectedShift = computed(() => this.data.shifts.find(s => s.id === this.shiftId()) ?? null);

  readonly period = computed(() => {
    const value = this.range();
    const from = value?.[0];
    const to = value?.[1] ?? from;
    if (!from || !to) return null;
    return {from: startOfDay(from), to: startOfDay(to)};
  });

  readonly daysCount = computed(() => {
    const p = this.period();
    return p ? daysInclusive(p.from, p.to) : 0;
  });

  readonly subtitle = computed(() => {
    const p = this.period();
    if (!p) return 'Оберіть дати';
    const fmt = (date: Date) => format(date, 'EEEEEE, d MMMM');
    return isSameDay(p.from, p.to) ? fmt(p.from) : `${fmt(p.from)} — ${fmt(p.to)}`;
  });

  readonly cellsCount = computed(() => this.daysCount() * this.employees.length);

  readonly overwriteCount = computed(() => {
    const p = this.period();
    if (!p || !this.occupied.size) return 0;
    let count = 0;
    for (const day of eachDayOfInterval({start: p.from, end: p.to})) {
      const date = toApiDate(day);
      count += this.employees.filter(e => this.occupied.has(`${e.id}|${date}`)).length;
    }
    return count;
  });

  readonly saveLabel = computed(() => {
    if (this.isBulk) return `Призначити: ${this.employees.length} × ${this.daysCount()} дн.`;
    return this.daysCount() > 1 ? `Призначити на ${this.daysCount()} дн.` : 'Зберегти';
  });

  readonly canSave = computed(() =>
    !!this.shiftId() && this.daysCount() > 0 && this.daysCount() <= 62 && !this.isSaving()
    && !(!this.isBulk && this.daysCount() === 1 && this.current?.shift?.id === this.shiftId())
  );

  ngOnInit(): void {
    if (this.current?.id) {
      this.historyLoading.set(true);
      this.historyService.getEmployeeShiftHistoryByEmployeeShiftId(this.current.id)
        .pipe(finalize(() => this.historyLoading.set(false)), takeUntil(this.destroy$))
        .subscribe(history => this.history.set(
          [...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        ));
    }
  }

  timeLabel(shift: Shift | null | undefined): string {
    return shift?.startTime && shift?.endTime ? `${shortTime(shift.startTime)}–${shortTime(shift.endTime)}` : '';
  }

  authorName(history: EmployeeShiftHistory): string {
    const a = history.author;
    if (!a) return '';
    const initials = [a.name, a.patronymic].filter(Boolean).map(x => `${x.charAt(0)}.`).join(' ');
    return `${a.surname ?? ''} ${initials}`.trim() || a.fullName;
  }

  save(): void {
    const p = this.period();
    const shiftId = this.shiftId();
    if (!p || !shiftId || !this.canSave()) return;

    const requests: CreateEmployeeShiftRequest[] = [];
    for (const employee of this.employees) {
      for (const day of eachDayOfInterval({start: p.from, end: p.to})) {
        requests.push({employeeId: employee.id, shiftId, date: toApiDate(day)});
      }
    }

    this.isSaving.set(true);
    this.employeeShiftService.createEmployeeShifts(requests)
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        const shift = this.selectedShift();
        const days = this.daysCount();
        this.notifications.success(this.isBulk
          ? `Зміну ${shift?.code} призначено ${this.employees.length} працівникам на ${days} дн.`
          : days > 1 ? `Зміну ${shift?.code} призначено на ${days} дн.` : `Зміну ${shift?.code} призначено`);
        this.ref.close(true);
      });
  }

  close(): void {
    this.ref.close(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
