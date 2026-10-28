import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {DatePipe, DecimalPipe} from '@angular/common';
import {FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {catchError, finalize, forkJoin, map, Observable, of, Subject, takeUntil} from 'rxjs';
import {addMonths, endOfMonth, isAfter, isBefore, startOfMonth} from 'date-fns';
import {toApiMonth, toDate} from '../../../../../shared/utils/date.utils';
import {PrimeTemplate} from 'primeng/api';
import {TableModule} from 'primeng/table';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {SelectButton} from 'primeng/selectbutton';
import {DatePicker} from 'primeng/datepicker';
import {FloatLabel} from 'primeng/floatlabel';
import {Tag} from 'primeng/tag';
import {Avatar} from 'primeng/avatar';
import {Tooltip} from 'primeng/tooltip';
import {ProgressBar} from 'primeng/progressbar';
import {Drawer} from 'primeng/drawer';
import {Skeleton} from 'primeng/skeleton';
import {AccountService} from '../../../../../core/account/services/account.service';
import {ConfirmService} from '../../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {UnitService} from '../../../structure/services/unit.service';
import {DepartmentService} from '../../../structure/services/department.service';
import {Unit} from '../../../structure/models/unit.model';
import {Department} from '../../../structure/models/department.model';
import {PayrollsService} from '../../services/payrolls-service';
import {PayrollSummary} from '../../models/payroll-summary.model';
import {Payroll} from '../../models/payroll.model';
import {PayrollStatus} from '../../enums/payroll-status.enum';
import {personInitials} from '../../../../../shared/utils/text.utils';
import {EmptyStateComponent} from '../../../../../shared/components/empty-state/empty-state.component';

type StatusFilter = 'all' | PayrollStatus;

@Component({
  selector: 'app-payrolls-page',
  standalone: true,
  imports: [EmptyStateComponent, 
    DatePipe, DecimalPipe, FormsModule, ReactiveFormsModule, PrimeTemplate, TableModule, Button, Select, SelectButton,
    DatePicker, FloatLabel, Tag, Avatar, Tooltip, ProgressBar, Drawer, Skeleton
  ],
  templateUrl: './payrolls-page.component.html',
  styleUrl: './payrolls-page.component.scss'
})
export class PayrollsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly fb = inject(FormBuilder);
  private readonly accountService = inject(AccountService);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly payrollsService = inject(PayrollsService);
  private readonly confirmService = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);
  private isInitialLoad = true;

  readonly PayrollStatus = PayrollStatus;
  readonly maxMonth = endOfMonth(new Date());

  readonly form = this.fb.group({
    unitId: this.fb.control<number | null>(null),
    departmentId: this.fb.control<number | null>(null),
    period: this.fb.control<Date>(startOfMonth(new Date()), {nonNullable: true})
  });

  readonly statusOptions = [
    {label: 'Усі', value: 'all' as StatusFilter},
    {label: 'Очікують', value: PayrollStatus.Pending as StatusFilter},
    {label: 'Виплачено', value: PayrollStatus.Paid as StatusFilter}
  ];

  readonly units = signal<Unit[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly summary = signal<PayrollSummary | null>(null);
  readonly isLoading = signal(false);
  readonly statusFilter = signal<StatusFilter>('all');
  readonly selected = signal<Payroll | null>(null);
  readonly payingIds = signal<Set<number>>(new Set());

  selectedRows: Payroll[] = [];

  readonly payrolls = computed(() => this.summary()?.payrolls ?? []);
  readonly visiblePayrolls = computed(() => {
    const filter = this.statusFilter();
    return filter === 'all' ? this.payrolls() : this.payrolls().filter(p => p.status === filter);
  });

  readonly stats = computed(() => {
    const list = this.payrolls();
    const paid = list.filter(p => p.status === PayrollStatus.Paid);
    const paidAmount = paid.reduce((sum, p) => sum + p.totalAmount, 0);
    const total = this.summary()?.totalAmount ?? 0;
    return {
      total,
      employees: this.summary()?.totalEmployees ?? list.length,
      hours: this.summary()?.totalWorkedHours ?? 0,
      paidCount: paid.length,
      pendingCount: list.length - paid.length,
      paidAmount,
      pendingAmount: total - paidAmount,
      paidPercent: total > 0 ? Math.round(paidAmount / total * 100) : 0
    };
  });

  ngOnInit(): void {
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
    this.summary.set(null);
    this.selected.set(null);
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
          this.loadPayrolls();
        }
        this.isInitialLoad = false;
      });
  }

  onFiltersChange(): void {
    this.selected.set(null);
    this.loadPayrolls();
  }

  shiftMonth(delta: number): void {
    const next = startOfMonth(addMonths(this.form.controls.period.value, delta));
    if (isAfter(next, this.maxMonth)) return;
    this.form.controls.period.setValue(next);
    this.onFiltersChange();
  }

  get canGoNext(): boolean {
    return isBefore(addMonths(this.form.controls.period.value, 1), this.maxMonth);
  }

  loadPayrolls(): void {
    const {departmentId, period} = this.form.getRawValue();
    this.selectedRows = [];
    if (!departmentId) {
      this.summary.set(null);
      return;
    }

    this.isLoading.set(true);
    this.payrollsService.getPayrollsByPeriod({
      departmentId,
      period: toApiMonth(period) as unknown as Date
    })
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(summary => {
        this.summary.set(summary);
        const current = this.selected();
        if (current) {
          this.selected.set(summary.payrolls.find(p => p.employeeId === current.employeeId) ?? null);
        }
      });
  }

  initials(payroll: Payroll): string {
    return personInitials(payroll.employee);
  }

  readonly isRowSelectable = (event: {data: Payroll}) => event.data.status !== PayrollStatus.Paid;

  get selectedTotal(): number {
    return this.selectedRows.reduce((sum, p) => sum + p.totalAmount, 0);
  }

  private markPaid$(payroll: Payroll): Observable<boolean> {
    const period = toDate(this.form.controls.period.value);
    return this.payrollsService.markPayrollAsPaid({
      employeeId: payroll.employeeId,
      period: new Date(period.getFullYear(), period.getMonth() + 1, 1)
    }).pipe(map(() => true), catchError(() => of(false)));
  }

  confirmPay(payroll: Payroll): void {
    this.confirmService.confirm({
      header: 'Підтвердження виплати',
      message: `Позначити зарплату ${payroll.employee.fullName} (${this.formatMoney(payroll.totalAmount)}) як виплачену?`,
      acceptLabel: 'Позначити виплаченою',
      acceptSeverity: 'success',
      icon: 'pi pi-wallet',
      onConfirm: () => this.pay([payroll])
    });
  }

  confirmPaySelected(): void {
    const items = [...this.selectedRows];
    this.confirmService.confirm({
      header: 'Масова виплата',
      message: `Позначити як виплачені зарплати обраних працівників (${items.length}) на суму ${this.formatMoney(this.selectedTotal)}?`,
      acceptLabel: 'Позначити виплаченими',
      acceptSeverity: 'success',
      icon: 'pi pi-wallet',
      onConfirm: () => this.pay(items)
    });
  }

  private pay(items: Payroll[]): void {
    this.payingIds.set(new Set(items.map(p => p.employeeId)));
    forkJoin(items.map(p => this.markPaid$(p)))
      .pipe(finalize(() => this.payingIds.set(new Set())), takeUntil(this.destroy$))
      .subscribe(results => {
        const ok = results.filter(Boolean).length;
        const failed = results.length - ok;
        if (ok) this.notifications.success(ok === 1 ? 'Зарплату позначено виплаченою' : `Позначено виплаченими: ${ok}`);
        if (failed) this.notifications.warn(`Не вдалося обробити: ${failed}`);
        this.loadPayrolls();
      });
  }

  isPaying(payroll: Payroll): boolean {
    return this.payingIds().has(payroll.employeeId);
  }

  private formatMoney(value: number): string {
    return `${new Intl.NumberFormat('uk-UA', {maximumFractionDigits: 2}).format(value)} ₴`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
