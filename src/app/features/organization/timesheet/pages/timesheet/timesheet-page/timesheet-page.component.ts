import {Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, viewChild} from '@angular/core';
import {DecimalPipe} from '@angular/common';
import {FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {catchError, finalize, of, Subject, takeUntil} from 'rxjs';
import moment from 'moment';
import 'moment/locale/uk';
import {PrimeTemplate} from 'primeng/api';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {SelectButton} from 'primeng/selectbutton';
import {DatePicker} from 'primeng/datepicker';
import {FloatLabel} from 'primeng/floatlabel';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Avatar} from 'primeng/avatar';
import {Checkbox} from 'primeng/checkbox';
import {Tooltip} from 'primeng/tooltip';
import {Skeleton} from 'primeng/skeleton';
import {DialogService} from 'primeng/dynamicdialog';
import {AccountService} from '../../../../../../core/account/services/account.service';
import {UnitService} from '../../../../structure/services/unit.service';
import {DepartmentService} from '../../../../structure/services/department.service';
import {Unit} from '../../../../structure/models/unit.model';
import {Department} from '../../../../structure/models/department.model';
import {Employee} from '../../../../employees/models/employee.model';
import {TimesheetService} from '../../../services/timesheet-service';
import {ShiftsService} from '../../../services/shifts.service';
import {Timesheet} from '../../../models/timesheet-model';
import {EmployeeShift} from '../../../models/employee-shift.model';
import {Shift} from '../../../models/shift.model';
import {readableTextColor, shortTime} from '../../../constants/shift-labels';
import {
  EmployeeShiftDialogComponent,
  EmployeeShiftDialogData
} from '../../../components/timesheet/employee-shift-dialog/employee-shift-dialog.component';
import {
  CopyScheduleDialogComponent,
  CopyScheduleDialogData
} from '../../../components/timesheet/copy-schedule-dialog/copy-schedule-dialog.component';
import {personInitials} from '../../../../../../shared/utils/text.utils';
import {EmptyStateComponent} from '../../../../../../shared/components/empty-state/empty-state.component';

type DisplayMode = 'shifts' | 'hours';

interface DayColumn {
  day: number;
  weekday: string;
  weekend: boolean;
  today: boolean;
}

interface TimesheetRow {
  employee: Employee;
  initials: string;
  shifts: (EmployeeShift | null)[];
  totalWorkDays: number;
  totalWorkHours: number;
}

interface DragState {
  fromRow: number;
  toRow: number;
  from: number;
  to: number;
}

@Component({
  selector: 'app-timesheet-page',
  standalone: true,
  imports: [EmptyStateComponent, 
    DecimalPipe, FormsModule, ReactiveFormsModule, PrimeTemplate, Button, Select, SelectButton, DatePicker, FloatLabel, IconField,
    InputIcon, InputText, Avatar, Checkbox, Tooltip, Skeleton
  ],
  providers: [DialogService],
  templateUrl: './timesheet-page.component.html',
  styleUrl: './timesheet-page.component.scss'
})
export class TimesheetPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly fb = inject(FormBuilder);
  private readonly accountService = inject(AccountService);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly timesheetService = inject(TimesheetService);
  private readonly shiftsService = inject(ShiftsService);
  private readonly dialogService = inject(DialogService);
  private isInitialLoad = true;
  private readonly sheetScroll = viewChild<ElementRef<HTMLElement>>('sheetScroll');

  readonly form = this.fb.group({
    unitId: this.fb.control<number | null>(null),
    departmentId: this.fb.control<number | null>(null),
    period: this.fb.control<Date>(moment().startOf('month').toDate(), {nonNullable: true})
  });

  readonly displayOptions = [
    {label: 'Зміни', value: 'shifts' as DisplayMode, icon: 'pi pi-th-large'},
    {label: 'Години', value: 'hours' as DisplayMode, icon: 'pi pi-clock'}
  ];

  readonly units = signal<Unit[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly shifts = signal<Shift[]>([]);
  readonly timesheet = signal<Timesheet | null>(null);
  readonly isLoading = signal(false);
  readonly isExporting = signal(false);
  readonly displayMode = signal<DisplayMode>('shifts');
  readonly search = signal('');
  readonly period = signal<Date>(this.form.controls.period.value);
  readonly drag = signal<DragState | null>(null);
  readonly selectedIds = signal<ReadonlySet<number>>(new Set());

  readonly selectedRows = computed(() => this.rows().filter(r => this.selectedIds().has(r.employee.id)));
  readonly allVisibleSelected = computed(() =>
    this.visibleRows().length > 0 && this.visibleRows().every(r => this.selectedIds().has(r.employee.id)));
  readonly someVisibleSelected = computed(() =>
    !this.allVisibleSelected() && this.visibleRows().some(r => this.selectedIds().has(r.employee.id)));

  readonly days = computed<DayColumn[]>(() => {
    const month = moment(this.period()).locale('uk');
    const today = moment();
    return Array.from({length: month.daysInMonth()}, (_, i) => {
      const date = month.clone().date(i + 1);
      return {
        day: i + 1,
        weekday: date.format('dd'),
        weekend: date.day() === 0 || date.day() === 6,
        today: date.isSame(today, 'day')
      };
    });
  });

  readonly rows = computed<TimesheetRow[]>(() => {
    const daysInMonth = this.days().length;
    return (this.timesheet()?.employeeTimesheets ?? []).map(t => {
      const shifts: (EmployeeShift | null)[] = new Array(daysInMonth + 1).fill(null);
      for (const s of t.employeeShifts) {
        if (s?.date) shifts[moment(s.date).date()] = s;
      }
      return {
        employee: t.employee,
        initials: this.initials(t.employee),
        shifts,
        totalWorkDays: t.totalWorkDays ?? 0,
        totalWorkHours: t.totalWorkHours ?? 0
      };
    });
  });

  readonly visibleRows = computed(() => {
    const query = this.search().trim().toLowerCase();
    return query ? this.rows().filter(r => r.employee.fullName?.toLowerCase().includes(query)) : this.rows();
  });

  readonly stats = computed(() => {
    const rows = this.rows();
    const days = this.days().length;
    const filled = rows.reduce((sum, r) => sum + r.shifts.filter(Boolean).length, 0);
    const total = rows.length * days;
    return {
      employees: rows.length,
      hours: rows.reduce((sum, r) => sum + r.totalWorkHours, 0),
      filled,
      filledPercent: total ? Math.round(filled / total * 100) : 0
    };
  });

  readonly legend = computed(() => {
    const used = new Map<number, Shift>();
    for (const row of this.rows()) {
      for (const s of row.shifts) {
        if (s?.shift && !used.has(s.shift.id)) used.set(s.shift.id, s.shift);
      }
    }
    return [...used.values()].sort((a, b) => a.code.localeCompare(b.code, 'uk'));
  });

  readonly monthTitle = computed(() => moment(this.period()).locale('uk').format('MMMM YYYY'));

  ngOnInit(): void {
    this.shiftsService.getShifts()
      .pipe(catchError(() => of([] as Shift[])), takeUntil(this.destroy$))
      .subscribe(shifts => this.shifts.set(shifts));

    this.unitService.getUnitsByRoles()
      .pipe(catchError(() => of([] as Unit[])), takeUntil(this.destroy$))
      .subscribe(units => {
        this.units.set(units);
        const userUnitId = this.accountService.currentUser()?.employee?.department?.unit?.id;
        if (this.isInitialLoad && userUnitId && units.some(u => u.id === userUnitId)) {
          this.form.patchValue({unitId: userUnitId}, {emitEvent: false});
          this.loadDepartments(userUnitId);
        } else {
          this.isInitialLoad = false;
        }
      });
  }

  onUnitChange(unitId: number | null): void {
    this.isInitialLoad = false;
    this.form.patchValue({departmentId: null}, {emitEvent: false});
    this.departments.set([]);
    this.timesheet.set(null);
    if (unitId) {
      this.loadDepartments(unitId);
    }
  }

  private loadDepartments(unitId: number): void {
    this.departmentService.getDepartmentsByRoles(unitId)
      .pipe(catchError(() => of([] as Department[])), takeUntil(this.destroy$))
      .subscribe(departments => {
        this.departments.set(departments);
        const userDepartmentId = this.accountService.currentUser()?.employee?.departmentId;
        if (this.isInitialLoad && userDepartmentId && departments.some(d => d.id === userDepartmentId)) {
          this.form.patchValue({departmentId: userDepartmentId}, {emitEvent: false});
          this.loadTimesheet();
        }
        this.isInitialLoad = false;
      });
  }

  onFiltersChange(): void {
    this.timesheet.set(null);
    this.selectedIds.set(new Set());
    this.loadTimesheet();
  }

  shiftMonth(delta: number): void {
    const next = moment(this.form.controls.period.value).add(delta, 'month').startOf('month');
    this.form.controls.period.setValue(next.toDate());
    this.onFiltersChange();
  }

  goToCurrentMonth(): void {
    this.form.controls.period.setValue(moment().startOf('month').toDate());
    this.onFiltersChange();
  }

  get isCurrentMonth(): boolean {
    return moment(this.form.controls.period.value).isSame(moment(), 'month');
  }

  private get periodParam(): Date {
    return moment(this.form.controls.period.value).format('YYYY-MM') as unknown as Date;
  }

  loadTimesheet(): void {
    const departmentId = this.form.controls.departmentId.value;
    this.period.set(this.form.controls.period.value);
    if (!departmentId) {
      this.timesheet.set(null);
      return;
    }

    this.isLoading.set(true);
    this.timesheetService.getTimesheet({departmentId, period: this.periodParam})
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe({
        next: timesheet => {
          const firstLoad = !this.timesheet();
          this.timesheet.set(timesheet);
          if (firstLoad) setTimeout(() => this.scrollToToday());
        },
        error: () => this.timesheet.set({startDate: new Date(), endDate: new Date(), employeeTimesheets: []})
      });
  }

  exportToExcel(): void {
    const departmentId = this.form.controls.departmentId.value;
    if (!departmentId) return;

    this.isExporting.set(true);
    this.timesheetService.exportTimesheet({
      departmentId,
      period: this.periodParam,
      exportWorkHours: this.displayMode() === 'hours'
    })
      .pipe(finalize(() => this.isExporting.set(false)), takeUntil(this.destroy$))
      .subscribe((blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Табель_за_${moment(this.form.controls.period.value).format('YYYY-MM')}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      });
  }

  private scrollToToday(attempt = 0): void {
    const container = this.sheetScroll()?.nativeElement;
    const today = container?.querySelector<HTMLElement>('thead th.today');
    if (!container || !today) {
      if (attempt < 10 && this.isCurrentMonth) setTimeout(() => this.scrollToToday(attempt + 1), 50);
      return;
    }
    const stickyWidth = (th: HTMLElement | null): number => {
      if (!th) return 0;
      const style = getComputedStyle(th);
      const pinned = style.position === 'sticky' && (style.left !== 'auto' || style.right !== 'auto');
      return pinned ? th.offsetWidth : 0;
    };
    const nameWidth = stickyWidth(container.querySelector<HTMLElement>('thead th.col-name'));
    if (!nameWidth) return;
    const totalsWidth = Array.from(container.querySelectorAll<HTMLElement>('thead th.col-total')).reduce((w, th) => w + stickyWidth(th), 0);
    const visibleStart = container.getBoundingClientRect().left + nameWidth;
    const visibleWidth = container.clientWidth - nameWidth - totalsWidth;
    const todayRect = today.getBoundingClientRect();
    const offset = todayRect.left - visibleStart - visibleWidth / 2 + todayRect.width / 2;
    container.scrollLeft = Math.max(0, container.scrollLeft + offset);
  }

  cellBackground(s: EmployeeShift | null): string | null {
    return s?.shift?.color || null;
  }

  cellColor(s: EmployeeShift | null): string | null {
    return s?.shift?.color ? readableTextColor(s.shift.color) : null;
  }

  hasTime(s: EmployeeShift | null): boolean {
    return !!s?.shift?.startTime && !!s?.shift?.endTime;
  }

  readonly shortTime = shortTime;

  cellTooltip(row: TimesheetRow, day: DayColumn): string {
    const s = row.shifts[day.day];
    const date = moment(this.period()).date(day.day).locale('uk').format('dd, D MMMM');
    if (!s?.shift) return `${date} — не заповнено`;
    const time = this.hasTime(s) ? ` · ${shortTime(s.shift.startTime)}–${shortTime(s.shift.endTime)}` : '';
    return `${date}\n${s.shift.code} — ${s.shift.description}${time}`;
  }

  openCopyDialog(): void {
    const departmentId = this.form.controls.departmentId.value;
    if (!departmentId) return;

    const month = moment(this.period());
    const selected = this.selectedRows();
    const rows = selected.length ? selected : this.visibleRows();
    const existing: Record<string, number> = {};
    for (const row of this.rows()) {
      row.shifts.forEach((s, day) => {
        if (s?.shift) existing[`${row.employee.id}|${month.clone().date(day).format('YYYY-MM-DD')}`] = s.shift.id;
      });
    }

    const ref = this.dialogService.open(CopyScheduleDialogComponent, {
      showHeader: false,
      modal: true,
      dismissableMask: true,
      width: '720px',
      breakpoints: {'760px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data: {
        departmentId,
        month: month.toDate(),
        employees: rows.map(r => r.employee),
        onlySelected: selected.length > 0,
        existing
      } satisfies CopyScheduleDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => {
      if (!changed) return;
      this.clearSelection();
      this.loadTimesheet();
    });
  }

  isSelected(row: TimesheetRow): boolean {
    return this.selectedIds().has(row.employee.id);
  }

  toggleRow(row: TimesheetRow): void {
    const next = new Set(this.selectedIds());
    next.has(row.employee.id) ? next.delete(row.employee.id) : next.add(row.employee.id);
    this.selectedIds.set(next);
  }

  toggleAllVisible(): void {
    const next = new Set(this.selectedIds());
    const select = !this.allVisibleSelected();
    this.visibleRows().forEach(r => select ? next.add(r.employee.id) : next.delete(r.employee.id));
    this.selectedIds.set(next);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  openBulkDialog(): void {
    const rows = this.selectedRows();
    if (!rows.length) return;
    const month = moment(this.period());
    const today = moment();
    const start = month.isSame(today, 'month') ? today.date() : 1;
    this.openShiftDialog(rows, start, start);
  }

  onCellMouseDown(event: MouseEvent, rowIndex: number, day: number): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.drag.set({fromRow: rowIndex, toRow: rowIndex, from: day, to: day});
  }

  onCellMouseEnter(rowIndex: number, day: number): void {
    const drag = this.drag();
    if (drag) {
      this.drag.set({...drag, toRow: rowIndex, to: day});
    }
  }

  isInDrag(rowIndex: number, day: number): boolean {
    const drag = this.drag();
    if (!drag) return false;
    return rowIndex >= Math.min(drag.fromRow, drag.toRow) && rowIndex <= Math.max(drag.fromRow, drag.toRow)
      && day >= Math.min(drag.from, drag.to) && day <= Math.max(drag.from, drag.to);
  }

  readonly dragSummary = computed(() => {
    const drag = this.drag();
    if (!drag) return '';
    const rows = Math.abs(drag.toRow - drag.fromRow) + 1;
    const days = Math.abs(drag.to - drag.from) + 1;
    return rows > 1 ? `${rows} праців. × ${days} дн.` : `${days} дн.`;
  });

  @HostListener('document:mouseup')
  onMouseUp(): void {
    const drag = this.drag();
    if (!drag) return;
    this.drag.set(null);

    const rows = this.visibleRows().slice(Math.min(drag.fromRow, drag.toRow), Math.max(drag.fromRow, drag.toRow) + 1);
    if (!rows.length) return;
    this.openShiftDialog(rows, Math.min(drag.from, drag.to), Math.max(drag.from, drag.to));
  }

  private openShiftDialog(rows: TimesheetRow[], fromDay: number, toDay: number): void {
    const month = moment(this.period());
    const single = rows.length === 1 && fromDay === toDay;

    const occupied: string[] = [];
    for (const row of rows) {
      row.shifts.forEach((s, day) => s && occupied.push(`${row.employee.id}|${month.clone().date(day).format('YYYY-MM-DD')}`));
    }

    const ref = this.dialogService.open(EmployeeShiftDialogComponent, {
      showHeader: false,
      modal: true,
      dismissableMask: true,
      width: '620px',
      breakpoints: {'680px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data: {
        employees: rows.map(r => r.employee),
        dateFrom: month.clone().date(fromDay).toDate(),
        dateTo: month.clone().date(toDay).toDate(),
        employeeShift: single ? rows[0].shifts[fromDay] ?? undefined : undefined,
        shifts: this.shifts(),
        occupied
      } satisfies EmployeeShiftDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => {
      if (!changed) return;
      if (rows.length > 1) this.clearSelection();
      this.loadTimesheet();
    });
  }

  private initials(employee: Employee): string {
    return personInitials(employee);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
