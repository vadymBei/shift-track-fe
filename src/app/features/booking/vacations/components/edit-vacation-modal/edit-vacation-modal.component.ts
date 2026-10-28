import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {finalize, Observable, Subject, takeUntil} from 'rxjs';
import {addDays} from 'date-fns';
import {formatDate, toDate} from '../../../../../shared/utils/date.utils';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Select} from 'primeng/select';
import {DatePicker} from 'primeng/datepicker';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {Tag} from 'primeng/tag';
import {Avatar} from 'primeng/avatar';
import {Timeline} from 'primeng/timeline';
import {PrimeTemplate} from 'primeng/api';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {VacationService} from '../../services/vacation.service';
import {Vacation, vacationPermissions} from '../../models/vacation.model';
import {EditVacationRequest} from '../../models/edit-vacation-request.model';
import {VacationStatus} from '../../enums/vacation-status.enum';
import {
  countVacationDays,
  isFinalStatus,
  pluralDays,
  toApiDate,
  VACATION_STATUS_META,
  VACATION_TYPE_GROUPS
} from '../../constants/vacation-labels';
import {personInitials} from '../../../../../shared/utils/text.utils';
import {Tooltip} from 'primeng/tooltip';

export interface EditVacationDialogData {
  vacation: Vacation;
}

type StepState = 'done' | 'current' | 'waiting' | 'rejected';

interface ApprovalStep {
  title: string;
  subtitle: string;
  state: StepState;
  marker: string;
}

@Component({
  selector: 'app-edit-vacation-modal',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, Select, DatePicker, Textarea, Button, Message, Tag, Avatar, Timeline, PrimeTemplate, Tooltip],
  templateUrl: './edit-vacation-modal.component.html',
  styleUrl: './edit-vacation-modal.component.scss'
})
export class EditVacationModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject<DynamicDialogConfig<EditVacationDialogData>>(DynamicDialogConfig);
  private readonly fb = inject(FormBuilder);
  private readonly vacationService = inject(VacationService);
  private readonly notifications = inject(NotificationService);

  readonly typeGroups = VACATION_TYPE_GROUPS;
  readonly vacation = signal<Vacation>(this.config.data!.vacation);
  readonly perm = computed(() => vacationPermissions(this.vacation()));
  readonly approveLabel = computed(() => this.perm().approveSubmitsForApproval ? 'Подати на погодження' : 'Погодити');
  readonly hasActions = computed(() => this.perm().canEdit || this.perm().canApprove || this.perm().canReject);
  readonly busyAction = signal<'save' | 'approve' | 'reject' | 'download' | null>(null);

  readonly form = this.fb.group({
    type: [null as string | null, [Validators.required]],
    period: this.fb.control<Date[] | null>(null, Validators.required),
    comment: ['', [Validators.maxLength(100)]]
  });

  private readonly period = toSignal(this.form.controls.period.valueChanges, {initialValue: null});
  private readonly comment = toSignal(this.form.controls.comment.valueChanges, {initialValue: ''});

  readonly status = computed(() => this.vacation().status);
  readonly statusMeta = computed(() => VACATION_STATUS_META[this.status()] ?? VACATION_STATUS_META[VacationStatus.None]);
  readonly isFinal = computed(() => isFinalStatus(this.status()));
  readonly initials = computed(() => personInitials(this.vacation().employee));

  readonly endDate = computed(() => this.period()?.[1] ?? null);
  readonly daysText = computed(() => pluralDays(countVacationDays(this.period()?.[0], this.endDate())));
  readonly returnDate = computed(() => this.endDate() ? addDays(this.endDate()!, 1) : null);
  readonly commentLength = computed(() => this.comment()?.length ?? 0);

  readonly steps = computed<ApprovalStep[]>(() => {
    const status = this.status();
    const created = this.vacation().createdAt ? formatDate(this.vacation().createdAt, 'dd.MM.yyyy, HH:mm') : '';
    if (status === VacationStatus.None) {
      return [
        {title: 'Чернетка', subtitle: 'Автор ще не подав заявку на погодження', state: 'current', marker: '1'},
        {title: 'Директор департаменту', subtitle: 'Після подання', state: 'waiting', marker: '2'},
        {title: 'Регіональний директор', subtitle: 'Після погодження директором', state: 'waiting', marker: '3'}
      ];
    }

    const submitted: ApprovalStep = {
      title: 'Заявку подано',
      subtitle: [this.vacation().employee?.fullName, created].filter(Boolean).join(' · '),
      state: 'done',
      marker: 'pi pi-check'
    };

    if (status === VacationStatus.Rejected) {
      return [submitted, {title: 'Заявку відхилено', subtitle: 'Погодження зупинено', state: 'rejected', marker: 'pi pi-times'}];
    }

    const deptDone = status === VacationStatus.ApprovedByDepartmentDirector || status === VacationStatus.ApprovedByUnitDirector;
    const unitDone = status === VacationStatus.ApprovedByUnitDirector;

    return [
      submitted,
      {
        title: 'Директор департаменту',
        subtitle: deptDone ? 'Погоджено' : 'Очікує рішення',
        state: deptDone ? 'done' : 'current',
        marker: deptDone ? 'pi pi-check' : '2'
      },
      {
        title: 'Регіональний директор',
        subtitle: unitDone ? 'Погоджено' : deptDone ? 'Очікує рішення' : 'Після погодження директором',
        state: unitDone ? 'done' : deptDone ? 'current' : 'waiting',
        marker: unitDone ? 'pi pi-check' : '3'
      }
    ];
  });

  ngOnInit(): void {
    this.fillForm(this.vacation());

    this.vacationService.getVacationById(this.vacation().id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(vacation => {
        this.vacation.set({...this.vacation(), ...vacation});
        this.fillForm(this.vacation());
      });
  }

  private fillForm(vacation: Vacation): void {
    this.form.reset({
      type: vacation.type,
      period: [toDate(vacation.startDate), toDate(vacation.endDate)],
      comment: vacation.comment ?? ''
    });

    if (vacationPermissions(vacation).canEdit) {
      this.form.enable();
    } else {
      this.form.disable();
    }
  }

  save(): void {
    const [start, end] = this.form.value.period ?? [];
    if (this.form.invalid || !start || !end) {
      this.form.markAllAsTouched();
      return;
    }

    const request: EditVacationRequest = {
      id: this.vacation().id,
      type: this.form.value.type as EditVacationRequest['type'],
      startDate: toApiDate(start) as unknown as Date,
      endDate: toApiDate(end) as unknown as Date,
      comment: this.form.value.comment ?? ''
    };

    this.run('save', this.vacationService.updateVacation(request), 'Зміни збережено');
  }

  approve(): void {
    const submitting = this.perm().approveSubmitsForApproval;
    this.run('approve', this.vacationService.approveVacation(this.vacation().id),
      submitting ? 'Заявку подано на погодження' : 'Заявку погоджено');
  }

  reject(): void {
    this.run('reject', this.vacationService.rejectVacation(this.vacation().id), 'Заявку відхилено');
  }

  download(): void {
    this.busyAction.set('download');
    this.vacationService.saveVacationRequestPdf(this.vacation())
      .pipe(finalize(() => this.busyAction.set(null)), takeUntil(this.destroy$))
      .subscribe();
  }

  close(): void {
    this.ref.close(false);
  }

  private run(action: 'save' | 'approve' | 'reject', request$: Observable<unknown>, successMessage: string): void {
    this.busyAction.set(action);
    request$
      .pipe(finalize(() => this.busyAction.set(null)), takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notifications.success(successMessage);
          this.ref.close(true);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
