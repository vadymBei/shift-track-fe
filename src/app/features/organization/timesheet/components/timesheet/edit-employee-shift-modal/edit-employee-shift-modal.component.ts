import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {BsModalRef} from "ngx-bootstrap/modal";
import {Employee} from "../../../../employees/models/employee.model";
import {DatePipe} from "@angular/common";
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

@Component({
  selector: 'app-edit-employee-shift-modal',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule
  ],
  templateUrl: './edit-employee-shift-modal.component.html',
  styleUrl: './edit-employee-shift-modal.component.scss'
})
export class EditEmployeeShiftModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  bsModalRef = inject(BsModalRef);

  private readonly shiftsService = inject(ShiftsService);
  private readonly employeeShiftService = inject(EmployeeShiftService);
  private fb = inject(FormBuilder);

  shifts = signal<Shift[]>([]);
  request = signal<CreateEmployeeShiftRequest[]>([]);
  employee?: Employee;
  employeeShiftDate?: Date;
  shift?: Shift;
  form: FormGroup = this.fb.group(
    {
      shiftId: [null, [Validators.required]],
      dateFrom: [this.formatDateForInput(new Date()), [Validators.required]],
      dateTo: [this.formatDateForInput(new Date()), [Validators.required]]
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

    if (this.shift) {
      this.form.patchValue({
        shiftId: this.shift.id
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
      })
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
