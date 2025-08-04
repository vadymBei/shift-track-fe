import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {BsModalRef} from "ngx-bootstrap/modal";
import {Subject, takeUntil} from "rxjs";
import {CommonModule} from "@angular/common";
import {CreateVacationRequest} from "../../models/create-vacation-request.modal";
import {VacationType} from "../../enums/vacation-type.enum";
import {AccountService} from "../../../../../core/account/services/account.service";
import {Employee} from "../../../../organization/employees/models/employee.model";
import {VacationService} from "../../services/vacation.service";
import moment from "moment";

@Component({
  selector: 'app-create-vacation-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './create-vacation-modal.component.html',
  styleUrl: './create-vacation-modal.component.scss'
})
export class CreateVacationModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  bsModalRef = inject(BsModalRef);
  private fb = inject(FormBuilder);
  private accountService = inject(AccountService);
  private vacationService = inject(VacationService);

  form: FormGroup = this.fb.group({
    startDate: [
      this.formatDateForInput(new Date()),
      [
        Validators.required
      ]
    ],
    endDate: [
      this.formatDateForInput(new Date()),
      [
        Validators.required
      ]
    ],
    type: [
      null,
      [
        Validators.required
      ]
    ],
    comment: [
      '',
      [
        Validators.maxLength(100)
      ]
    ],
  });

  employee = signal<Employee | null>(null);
  request = signal<CreateVacationRequest>({
    type: VacationType.None,
    comment: '',
    startDate: new Date(),
    endDate: new Date(),
    employeeId: 0
  });

  ngOnInit(): void {
    this.loadCurrentEmployee();
  }

  private formatDateForInput(date: Date): string {
    return moment(date).format('YYYY-MM-DD');
  }

  loadCurrentEmployee(): void {
    this.accountService.getCurrentUser()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (currentUser) => {
          if (currentUser && currentUser.employee) {
            this.employee.set(currentUser.employee);
          }
        }
      });
  }

  save() {
    if (!this.employee())
      return;

    this.request.update(req => ({
      ...req,
      type: this.form.value.type,
      comment: this.form.value.comment,
      startDate: this.form.value.startDate,
      endDate: this.form.value.endDate,
      employeeId: this.employee()?.id || 0,
    }));

    this.vacationService.createVacation(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.bsModalRef.hide();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
