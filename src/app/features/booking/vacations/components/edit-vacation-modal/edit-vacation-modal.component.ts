import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from "@angular/forms";
import {BsModalRef} from "ngx-bootstrap/modal";
import {Vacation} from "../../models/vacation.model";
import {Subject, takeUntil} from "rxjs";
import {VacationService} from "../../services/vacation.service";
import moment from "moment/moment";
import {VacationType} from "../../enums/vacation-type.enum";
import {EditVacationRequest} from "../../models/edit-vacation-request.model";

@Component({
  selector: 'app-edit-vacation-modal',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './edit-vacation-modal.component.html',
  styleUrl: './edit-vacation-modal.component.scss'
})
export class EditVacationModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly vacationService = inject(VacationService);

  vacation?: Vacation;
  fb = inject(FormBuilder);
  bsModalRef = inject(BsModalRef);

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

  request = signal<EditVacationRequest>({
    id: 0,
    type: VacationType.None,
    comment: '',
    startDate: new Date(),
    endDate: new Date(),
  });

  ngOnInit(): void {
    this.getVacationById();
  }

  private formatDateForInput(date: Date): string {
    return moment(date).format('YYYY-MM-DD');
  }

  private getVacationById() {
    this.vacationService.getVacationById(this.vacation!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(vacation => {
        this.form.patchValue({
          type: vacation.type,
          comment: vacation.comment,
          startDate: moment(vacation.startDate).format('YYYY-MM-DD'),
          endDate: moment(vacation.endDate).format('YYYY-MM-DD'),
        })
      });
  }

  save() {
    if (!this.vacation)
      return;

    this.request.update(req => ({
      ...req,
      type: this.form.value.type,
      comment: this.form.value.comment,
      id: this.vacation!.id,
      startDate: this.form.value.startDate,
      endDate: this.form.value.endDate
    }));

    this.vacationService.updateVacation(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.bsModalRef.hide();
        }
      });
  }

  approveVacation() {
    this.vacationService.approveVacation(this.vacation!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.bsModalRef.hide();
        },
        error: () => {
          this.bsModalRef.hide();
        }
      });
  }

  rejectVacation(){
    this.vacationService.rejectVacation(this.vacation!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.bsModalRef.hide();
        },
        error: () => {
          this.bsModalRef.hide();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
