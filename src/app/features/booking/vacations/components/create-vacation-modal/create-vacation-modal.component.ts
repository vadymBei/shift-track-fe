import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize, Subject, takeUntil} from 'rxjs';
import moment from 'moment';
import {DynamicDialogRef} from 'primeng/dynamicdialog';
import {Select} from 'primeng/select';
import {DatePicker} from 'primeng/datepicker';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {AccountService} from '../../../../../core/account/services/account.service';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {VacationService} from '../../services/vacation.service';
import {CreateVacationRequest} from '../../models/create-vacation-request.modal';
import {countVacationDays, pluralDays, toApiDate, VACATION_TYPE_GROUPS} from '../../constants/vacation-labels';
import {VacationType} from '../../enums/vacation-type.enum';

@Component({
  selector: 'app-create-vacation-modal',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, Select, DatePicker, Textarea, Button, Message],
  templateUrl: './create-vacation-modal.component.html',
  styleUrl: './create-vacation-modal.component.scss'
})
export class CreateVacationModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly ref = inject(DynamicDialogRef);
  private readonly fb = inject(FormBuilder);
  private readonly accountService = inject(AccountService);
  private readonly vacationService = inject(VacationService);
  private readonly notifications = inject(NotificationService);

  readonly typeGroups = VACATION_TYPE_GROUPS;
  readonly today = moment().startOf('day').toDate();
  readonly employee = computed(() => this.accountService.currentUser()?.employee);
  readonly isSaving = signal(false);

  readonly form = this.fb.group({
    type: [null as string | null, [Validators.required]],
    period: this.fb.control<Date[] | null>(null, Validators.required),
    comment: ['', [Validators.maxLength(100)]]
  });

  private readonly period = toSignal(this.form.controls.period.valueChanges, {initialValue: null});
  private readonly comment = toSignal(this.form.controls.comment.valueChanges, {initialValue: ''});
  private readonly type = toSignal(this.form.controls.type.valueChanges, {initialValue: null});

  /** Annual vacation is available only after 6 months of continuous work (art. 10 of the Law "On Vacations"). */
  readonly annualVacationAvailableFrom = signal<Date | null>(null);
  readonly isAnnualType = computed(() => this.type() === VacationType.YearMainVacation);
  readonly annualRestricted = computed(() => {
    const from = this.annualVacationAvailableFrom();
    return this.isAnnualType() && !!from && from > this.today;
  });
  readonly minDate = computed(() => this.annualRestricted() ? this.annualVacationAvailableFrom()! : this.today);
  readonly startsTooEarly = computed(() => {
    const start = this.startDate();
    return this.annualRestricted() && !!start && start < this.minDate();
  });

  readonly startDate = computed(() => this.period()?.[0] ?? null);
  readonly endDate = computed(() => this.period()?.[1] ?? null);
  readonly daysCount = computed(() => countVacationDays(this.startDate(), this.endDate()));
  readonly daysLabel = computed(() => pluralDays(this.daysCount()).replace(/^\d+ /, ''));
  readonly returnDate = computed(() => this.endDate() ? moment(this.endDate()).add(1, 'day').toDate() : null);
  readonly commentLength = computed(() => this.comment()?.length ?? 0);

  ngOnInit(): void {
    const employeeId = this.employee()?.id;
    if (!employeeId) return;

    this.vacationService.getVacationBalanceByEmployeeId(employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(balance => this.annualVacationAvailableFrom.set(
        moment(balance.annualVacationAvailableFrom).startOf('day').toDate()));
  }

  get isPeriodIncomplete(): boolean {
    const control = this.form.controls.period;
    return (control.touched || control.dirty) && !this.endDate();
  }

  save(): void {
    const employee = this.employee();
    const start = this.startDate();
    const end = this.endDate();

    if (this.form.invalid || !employee || !start || !end || this.startsTooEarly()) {
      this.form.markAllAsTouched();
      return;
    }

    const request: CreateVacationRequest = {
      employeeId: employee.id,
      type: this.form.value.type as CreateVacationRequest['type'],
      startDate: toApiDate(start) as unknown as Date,
      endDate: toApiDate(end) as unknown as Date,
      comment: this.form.value.comment ?? ''
    };

    this.isSaving.set(true);
    this.vacationService.createVacation(request)
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.notifications.success('Заявку на відпустку подано');
          this.ref.close(true);
        }
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
