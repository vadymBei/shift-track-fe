import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {DatePipe, DecimalPipe, NgClass} from "@angular/common";
import {FormBuilder, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {Unit} from "../../../structure/models/unit.model";
import {Department} from "../../../structure/models/department.model";
import {PayrollRequest} from "../../models/payroll-request.model";
import {debounceTime} from "rxjs/operators";
import {catchError, of, Subject, takeUntil} from "rxjs";
import {UnitService} from "../../../structure/services/unit.service";
import {DepartmentService} from "../../../structure/services/department.service";
import {PayrollSummary} from "../../models/payroll-summary.model";
import {PayrollsService} from "../../services/payrolls-service";
import {Payroll} from "../../models/payroll.model";
import {PayrollStatus} from "../../enums/payroll-status.enum";
import {MarkPayrollPaidRequest} from "../../models/mark-payroll-paid-request.model";

@Component({
  selector: 'app-payrolls-page',
  standalone: true,
  imports: [
    NgClass,
    DecimalPipe,
    DatePipe,
    ReactiveFormsModule,
  ],
  templateUrl: './payrolls-page.component.html',
  styleUrl: './payrolls-page.component.scss'
})
export class PayrollsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  private readonly fb = inject(FormBuilder);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly payrollsService = inject(PayrollsService);

  readonly PayrollStatus = PayrollStatus;

  wasDepartmentSelected = false;
  wasUnitSelected = false;
  showPayrolls = false;
  shiftsExpanded = false;
  selectedPayroll: Payroll | null = null;
  form: FormGroup = this.fb.group({
    unitId: [null],
    departmentId: [null],
    displayMode: ['shifts'],
    period: [this.formatCurrentDate()]
  });
  payrollSummary = signal<PayrollSummary | null>(null);
  units = signal<Unit[]>([]);
  departments = signal<Department[]>([]);
  request = signal<PayrollRequest>({
    period: new Date(),
    departmentId: 0
  });
  markPayrollPaidRequest = signal<MarkPayrollPaidRequest>({
    employeeId: 0,
    period: new Date()
  });

  ngOnInit() {
    this.getUnitsByRoles();

    this.searchSubject$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(searchPattern => {
      });
  }

  getUnitsByRoles(): void {
    this.unitService.getUnitsByRoles()
      .pipe(
        catchError(error => {
          return of([] as Unit[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(units => {
        this.units.set(units);
      });
  }

  getDepartmentsByRoles(unitId: number): void {
    this.departmentService.getDepartmentsByRoles(unitId)
      .pipe(
        catchError(error => {
          return of([] as Department[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(departments => {
        this.departments.set(departments);
      });
  }

  onUnitChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (unitId !== 'null') {
      this.wasDepartmentSelected = false;
      this.getDepartmentsByRoles(Number(unitId));
    }

    this.departments.set([]);
    this.form.get('departmentId')?.setValue(null);

    this.showPayrolls = false;
    this.wasUnitSelected = true;
    this.selectedPayroll = null;
  }

  onDepartmentChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const departmentId = selectElement.value;

    if (departmentId !== 'null') {
      this.payrollSummary.set(null);

      this.getPayrolls();

      this.wasDepartmentSelected = true;
      this.selectedPayroll = null;
    }
  }

  onPeriodChange(event: Event): void {
    this.selectedPayroll = null;
    this.getPayrolls();
  }

  private formatCurrentDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  getPayrolls() {
    if (this.form.value.departmentId === undefined
      || this.form.value.period === new Date()) {
      this.payrollSummary.set(null);
    }

    this.request.update(val => ({
      ...val,
      departmentId: this.form.value.departmentId,
      period: this.form.value.period
    }));

    this.payrollsService.getPayrollsByPeriod(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => this.payrollSummary.set(summary));

    this.showPayrolls = true;
  }

  selectEmployee(payroll: Payroll): void {
    this.selectedPayroll = payroll;
    this.shiftsExpanded = false;
  }

  markPayrollAsPaid(employeeId: number) {
    const [year, month] = (this.form.value.period as string).split('-').map(Number);

    this.markPayrollPaidRequest.set({
      employeeId: employeeId,
      period: new Date(year, month, 1)
    });

    this.payrollsService.markPayrollAsPaid(this.markPayrollPaidRequest())
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.selectedPayroll = null;
        this.getPayrolls();
      });
  }

  closeDetails(): void {
    this.selectedPayroll = null;
    this.shiftsExpanded = false;
  }

  trackById(_: number, payroll: Payroll): number {
    return payroll.employeeId;
  }

  get totalSalary(): number {
    return this.payrollSummary()?.totalAmount ?? 0;
  }

  get totalHours(): number {
    return this.payrollSummary()?.totalWorkedHours ?? 0;
  }

  get totalEmployees(): number {
    return this.payrollSummary()?.totalEmployees ?? 0;
  }

  get payrolls(): Payroll[] {
    return this.payrollSummary()?.payrolls ?? [];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
