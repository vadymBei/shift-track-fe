import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {Employee} from "../../../../employees/models/employee.model";
import {CommonModule} from "@angular/common";
import {BsModalService} from 'ngx-bootstrap/modal';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {BsDatepickerModule} from 'ngx-bootstrap/datepicker';
import {Shift} from "../../../models/shift.model";
import moment from "moment";
import 'moment/locale/uk';
import {ShiftType} from "../../../enums/shift-type.enum";
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


  selectedMonth = signal<Date>(new Date());
  searchTerm = signal<string>('');
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
  shifts = signal<Shift[]>([
    {
      id: 1,
      code: "-",
      description: "Звільнено",
      color: "#FFFFFF",
      startTime: null,
      endTime: null,
      workHours: null,
      type: ShiftType.none
    },
    {
      id: 2,
      code: "В",
      description: "Основна щорічна відпустка",
      color: "#FFF176",
      startTime: null,
      endTime: null,
      workHours: null,
      type: ShiftType.vacation
    },
    {
      id: 3,
      code: "ВД",
      description: "Відрядження",
      color: "#A08780",
      startTime: "10:00:00",
      endTime: "20:00:00",
      workHours: "10:00:00",
      type: ShiftType.workday
    },
    {
      id: 4,
      code: "ВП",
      description: "Відпустка у зв'язку з вагітністю і пологами",
      color: "#FFFFFF",
      startTime: null,
      endTime: null,
      workHours: null,
      type: ShiftType.vacation
    },
    {
      id: 5,
      code: "ВХ",
      description: "Вихідний день",
      color: "#E0E0E0",
      startTime: null,
      endTime: null,
      workHours: null,
      type: ShiftType.dayOff
    },
    {
      id: 6,
      code: "ДД",
      description: "Відпустка за дитиною до 6-ти років",
      color: "#FFFFFF",
      startTime: null,
      endTime: null,
      workHours: null,
      type: ShiftType.vacation
    },
    {
      id: 7,
      code: "І",
      description: "Інші причини неявок",
      color: "#FFFFFF",
      startTime: null,
      endTime: null,
      workHours: null,
      type: ShiftType.none
    },
    {
      id: 8,
      code: "НА",
      description: "Відпустка без збереження заробітної плати за згодою обох сторін",
      color: "#FFFFFF",
      startTime: null,
      endTime: null,
      workHours: null,
      type: ShiftType.vacation
    },
    {
      id: 9,
      code: "Р10",
      description: "10-ти годинний робочий день",
      color: "#DDE776",
      startTime: "10:00:00",
      endTime: "20:00:00",
      workHours: "10:00:00",
      type: ShiftType.workday
    },
    {
      id: 10,
      code: "Р9",
      description: "9-ти годинний робочий день",
      color: "#AED584",
      startTime: "10:00:00",
      endTime: "19:00:00",
      workHours: "09:00:00",
      type: ShiftType.workday
    }
  ]);
  request = signal<TimesheetRequest>({
    period: new Date(),
    departmentId: 0
  });

  constructor(private modalService: BsModalService) {
    moment.locale('uk');
  }

  ngOnInit() {
    this.initializeTimesheet();

    this.getUnits();

    this.searchSubject$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(searchPattern => {
      });
  }

  private initializeTimesheet() {
    const currentDate = moment(this.selectedMonth());
    const daysInMonth = currentDate.daysInMonth();

    const dayOffShift = this.shifts().find(s => s.code === 'ВХ');
    const defaultWorkdayShift = this.shifts().find(s => s.code === 'Р9');

    const shifts: (Shift | null)[] = Array(daysInMonth).fill(null).map((_, index) => {
      const day = index + 1;
      const date = moment(currentDate).date(day);
      const isWeekend = date.day() === 0 || date.day() === 6;

      return isWeekend ? dayOffShift! : defaultWorkdayShift!;
    });

    let totalWorkDays = 0;
    let totalWorkMinutes = 0;

    shifts.forEach(shift => {
      if (shift?.type === ShiftType.workday) {
        totalWorkDays++;
        if (shift.workHours) {
          const [hours, minutes] = shift.workHours.split(':').map(Number);
          totalWorkMinutes += hours * 60 + minutes;
        }
      }
    });
  }

  isWeekend(day: number): boolean {
    const date = moment(this.form.get('period')?.value).date(day);
    const dayOfWeek = date.day();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  getCellStyle(day: number, employeeId: number): { [key: string]: string } {
    const baseStyle: { [key: string]: string } = {};

    const shift = this.getShiftForDay(employeeId, day);

    if (shift?.color) {
      baseStyle['background-color'] = shift.color;
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

  getShiftForDay(employeeId: number, day: number): Shift | undefined {
    const employeeTimesheet = this.timesheet().employeeTimesheets.find(t => t.employee.id === employeeId);

    const employeeShift = employeeTimesheet?.employeeShifts.find(
      x => moment(x?.date).date() === day
    );

    return employeeShift?.shift;
  }

  openEditEmployeeShiftModal(employee: Employee, day: number, shift: Shift | undefined): void {
    const employeeShiftDate = moment(this.selectedMonth())
      .date(day)
      .toDate();

    const ref = this.modalService.show(
      EditEmployeeShiftModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          employeeShiftDate: employeeShiftDate,
          employee: employee,
          shift: shift
        }
      });

    ref.onHidden?.subscribe({
      next: () => this.getTimesheet()
    });
  }

  exportToExcel() {
    // TODO: Implement Excel export
  }

  onSearchChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchSubject$.next(inputElement.value);
  }

  onUnitChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (unitId === 'null') {
      this.departments.set([]);
      this.form.get('departmentId')?.setValue(null);
    } else {
      const numericUnitId = Number(unitId);
      this.getDepartmentsByUnitId(numericUnitId);
    }
  }

  onDepartmentChange(event: Event): void {
    this.getTimesheet();
  }

  onPeriodChange(event: Event): void {
    this.getTimesheet();
  }

  getUnits(): void {
    this.unitService.getUnits()
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

  getDepartmentsByUnitId(unitId: number): void {
    this.departmentService.getDepartmentsByUnitId(unitId)
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
  }

  getCellContent(shift: Shift | undefined): string {
    const displayMode = this.form.get('displayMode')?.value;

    if (!shift) return '';

    if (displayMode === 'shifts') {
      return shift.code;
    } else {
      if (shift.startTime && shift.endTime) {
        return `${shift.startTime.slice(0, 5)}\n${shift.endTime.slice(0, 5)}`;
      } else {
        return shift.code;
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
