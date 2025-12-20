import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {BsModalRef} from "ngx-bootstrap/modal";
import {Employee} from "../../../../employees/models/employee.model";
import {CommonModule, DatePipe} from "@angular/common";
import {ShiftsService} from "../../../services/shifts.service";
import {Shift} from "../../../models/shift.model";
import {Subject, takeUntil} from "rxjs";
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from "@angular/forms";
import moment from "moment";
import {CreateEmployeeShiftRequest} from "../../../models/create-employee-shift-request.model";
import {EmployeeShiftService} from "../../../services/employee-shift-service";
import {TabsModule} from "ngx-bootstrap/tabs";
import {EmployeeShiftHistoryService} from "../../../services/employee-shift-history-service";
import {EmployeeShift} from "../../../models/employee-shift.model";
import {EmployeeShiftHistory} from "../../../models/employee-shift-history.model";

@Component({
  selector: 'app-edit-employee-shift-modal',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ReactiveFormsModule,
    TabsModule,
  ],
  templateUrl: './edit-employee-shift-modal.component.html',
  styleUrl: './edit-employee-shift-modal.component.scss'
})
export class EditEmployeeShiftModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  bsModalRef = inject(BsModalRef);

  private readonly shiftsService = inject(ShiftsService);
  private readonly employeeShiftService = inject(EmployeeShiftService);
  private readonly employeeShiftHistoryService = inject(EmployeeShiftHistoryService);
  private fb = inject(FormBuilder);

  shifts = signal<Shift[]>([]);
  employeeShiftHistory = signal<EmployeeShiftHistory[]>([]);
  request = signal<CreateEmployeeShiftRequest[]>([]);
  employee?: Employee;
  employeeShiftDate?: Date;
  employeeShift?: EmployeeShift;
  form: FormGroup = this.fb.group(
    {
      shiftId: [null, [Validators.required]],
      dateFrom: [this.formatDateForInput(this.employeeShiftDate!), [Validators.required]],
      dateTo: [this.formatDateForInput(this.employeeShiftDate!), [Validators.required]]
    },
    {
      validators: this.dateRangeValidator
    });

  private dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const dateFrom = control.get('dateFrom')?.value;
    const dateTo = control.get('dateTo')?.value;

    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);

      if (from > to) {
        return {dateRange: true};
      }
    }

    return null;
  }

  ngOnInit(): void {
    this.getShifts();

    if (this.employeeShift) {
      this.getEmployeeShiftHistory(this.employeeShift.id);

      this.form.patchValue({
        shiftId: this.employeeShift.shift.id
      });
    }

    this.form.patchValue({
      dateFrom: this.formatDateForInput(this.employeeShiftDate!),
      dateTo: this.formatDateForInput(this.employeeShiftDate!),
    });
  }

  getShifts() {
    this.shiftsService.getShifts()
      .pipe(takeUntil(this.destroy$))
      .subscribe(shifts => {
        this.shifts.set(shifts);
      });
  }

  getEmployeeShiftHistory(employeeShiftId: number){
    this.employeeShiftHistoryService.getEmployeeShiftHistoryByEmployeeShiftId(employeeShiftId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(history => this.employeeShiftHistory.set(history));
  }

  private formatDateForInput(date: Date): string {
    return moment(date).format('YYYY-MM-DD');
  }

  save() {
    const dateFrom = moment(this.form.value.dateFrom);
    const dateTo = moment(this.form.value.dateTo);
    const shiftId = this.form.value.shiftId;

    const requests: CreateEmployeeShiftRequest[] = [];

    let currentDate = dateFrom.clone();

    while (currentDate.isSameOrBefore(dateTo)) {
      requests.push({
        employeeId: this.employee!.id,
        shiftId: shiftId,
        date: currentDate.format('YYYY-MM-DD')
      } as CreateEmployeeShiftRequest);

      currentDate.add(1, 'day');
    }

    this.request.set(requests);

    this.employeeShiftService.createEmployeeShifts(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.bsModalRef.hide();
        },
        error: error => {
          console.error('creating employee shift error', error);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
