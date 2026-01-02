import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {Employee} from "../../../../employees/models/employee.model";
import {CommonModule} from "@angular/common";
import {BsModalService} from 'ngx-bootstrap/modal';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {BsDatepickerModule} from 'ngx-bootstrap/datepicker';
import moment from "moment";
import 'moment/locale/uk';
import {TooltipModule} from "ngx-bootstrap/tooltip";
import {Unit} from "../../../../structure/models/unit.model";
import {Department} from "../../../../structure/models/department.model";
import {catchError, of, Subject, takeUntil} from "rxjs";
import {DepartmentService} from "../../../../structure/services/department.service";
import {UnitService} from "../../../../structure/services/unit.service";
import {debounceTime} from "rxjs/operators";
import {
  EditEmployeeShiftModalComponent
} from "../../../components/timesheet/edit-employee-shift-modal/edit-employee-shift-modal.component";
import {DayInfo} from "../../../models/day-info.model";
import {TimesheetRequest} from "../../../models/timesheet-request.model";
import {Timesheet} from "../../../models/timesheet-model";
import {TimesheetService} from "../../../services/timesheet-service";
import {ExportTimesheetRequest} from "../../../models/export-timesheet-request.model";
import {EmployeeShift} from "../../../models/employee-shift.model";

@Component({
  selector: 'app-timesheet-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    BsDatepickerModule,
    TooltipModule,
    ReactiveFormsModule
  ],
  templateUrl: './timesheet-page.component.html',
  styleUrl: './timesheet-page.component.scss'
})
export class TimesheetPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly fb = inject(FormBuilder);
  private readonly departmentService = inject(DepartmentService);
  private readonly unitService = inject(UnitService);
  private readonly timesheetService = inject(TimesheetService);

  private readonly searchSubject$ = new Subject<string>();

  wasDepartmentSelected = false;
  wasUnitSelected = false;
  showTimesheet = false;
  timesheet = signal<Timesheet>({
    startDate: new Date(),
    endDate: new Date(),
    employeeTimesheets: []
  });
  form: FormGroup = this.fb.group({
    unitId: [null],
    departmentId: [null],
    displayMode: ['shifts'],
    period: [this.formatCurrentDate()]
  });
  units = signal<Unit[]>([]);
  departments = signal<Department[]>([]);
  request = signal<TimesheetRequest>({
    period: new Date(),
    departmentId: 0
  });
  exportTimesheetRequest = signal<ExportTimesheetRequest>({
    exportWorkHours: true,
    departmentId: 0,
    period: new Date()
  });

  constructor(private modalService: BsModalService) {
    moment.locale('uk');
  }

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

    if (unitId === 'null') {
      this.departments.set([]);
      this.form.get('departmentId')?.setValue(null);
    } else {
      this.wasDepartmentSelected = false;

      this.getDepartmentsByRoles(Number(unitId));
    }

    this.showTimesheet = false;
    this.wasUnitSelected = true;
  }

  onDepartmentChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const departmentId = selectElement.value;

    if (departmentId !== 'null') {
      this.timesheet.update(val => ({
        ...val,
        employeeTimesheets: []
      }));

      this.getTimesheet();

      this.wasDepartmentSelected = true;
    }
  }

  getTimesheet() {
    if (this.form.value.departmentId === undefined
      || this.form.value.period === new Date()) {
      this.timesheet.update(val => ({
        ...val,
        employeeTimesheets: []
      }));
    }

    this.request.update(val => ({
      ...val,
      departmentId: this.form.value.departmentId,
      period: this.form.value.period
    }));

    this.timesheetService.getTimesheet(this.request())
      .subscribe(value => {
        this.timesheet.update(val => ({
          ...val,
          endDate: value.endDate,
          startDate: value.startDate,
          employeeTimesheets: value.employeeTimesheets
        }));
      });

    this.showTimesheet = true;
  }

  onSearchChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchSubject$.next(inputElement.value);
  }

  onPeriodChange(event: Event): void {
    this.getTimesheet();
  }

  isWeekend(day: number): boolean {
    const date = moment(this.form.get('period')?.value).date(day);
    const dayOfWeek = date.day();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  getCellStyle(day: number, employeeId: number): { [key: string]: string } {
    const baseStyle: { [key: string]: string } = {};

    const employeeShift = this.getEmployeeShiftForDay(employeeId, day);

    if (employeeShift?.shift?.color) {
      baseStyle['background-color'] = employeeShift.shift.color;
    }

    return baseStyle;
  }

  getDays(): DayInfo[] {
    const date = moment(this.form.get('period')?.value);
    return Array.from(
      {length: date.daysInMonth()},
      (_, i) => {
        const currentDate = moment(date).date(i + 1);
        return {
          dayOfMonth: i + 1,
          dayOfWeek: currentDate.format('dd').toUpperCase()
        };
      }
    );
  }

  private formatCurrentDate(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  getEmployeeTotalWorkDays(employeeId: number): number | undefined {
    return this.timesheet().employeeTimesheets.find(t => t.employee.id === employeeId)?.totalWorkDays;
  }

  getEmployeeTotalWorkHours(employeeId: number): number | undefined {
    return this.timesheet().employeeTimesheets.find(t => t.employee.id === employeeId)?.totalWorkHours;
  }

  getEmployeeShiftForDay(employeeId: number, day: number): EmployeeShift | undefined | null {
    const employeeTimesheet = this.timesheet().employeeTimesheets.find(t => t.employee.id === employeeId);

    const employeeShift = employeeTimesheet?.employeeShifts.find(
      x => moment(x?.date).date() === day
    );

    return employeeShift;
  }

  trackByEmployeeId(index: number, item: any): any {
    return item.employee.id;
  }

  trackByDay(index: number, day: any): any {
    return day.dayOfMonth;
  }

  openEditEmployeeShiftModal(employee: Employee, day: number, employeeShift: EmployeeShift | undefined | null): void {
    const employeeShiftDate = moment(this.request().period)
      .date(day)
      .toDate();

    const ref = this.modalService.show(
      EditEmployeeShiftModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          employeeShiftDate: employeeShiftDate,
          employee: employee,
          employeeShift: employeeShift ?? undefined
        }
      });

    ref.onHidden?.subscribe({
      next: () => this.getTimesheet()
    });
  }

  exportToExcel() {
    const displayMode = this.form.get('displayMode')?.value;

    if (displayMode === 'shifts') {
      this.exportTimesheetRequest.update(val => ({
        ...val,
        exportWorkHours: false
      }));
    } else {
      this.exportTimesheetRequest.update(val => ({
        ...val,
        exportWorkHours: true
      }));
    }

    if (this.form.value.departmentId === undefined
      || this.form.value.period === new Date()) {
      return;
    }

    this.exportTimesheetRequest.update(val => ({
      ...val,
      departmentId: this.form.value.departmentId,
      period: this.form.value.period
    }));

    this.timesheetService.exportTimesheet(this.exportTimesheetRequest())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = url;

          const period = moment(this.form.value.period).format('YYYY-MM');
          link.download = `Табель_за_${period}.xlsx`;

          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          window.URL.revokeObjectURL(url);
        }
      });
  }

  getCellContent(employeeShift: EmployeeShift | undefined | null): string {
    const displayMode = this.form.get('displayMode')?.value;

    if (!employeeShift) return '';

    if (displayMode === 'shifts') {
      return employeeShift.shift.code;
    } else {
      if (employeeShift.shift.startTime && employeeShift.shift.endTime) {
        return `${employeeShift.shift.startTime.slice(0, 5)}\n${employeeShift.shift.endTime.slice(0, 5)}`;
      } else {
        return employeeShift.shift.code;
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
