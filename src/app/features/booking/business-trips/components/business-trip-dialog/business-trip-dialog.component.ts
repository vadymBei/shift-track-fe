import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormBuilder, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {catchError, finalize, Observable, of, Subject, takeUntil} from 'rxjs';
import moment from 'moment';
import {PrimeTemplate} from 'primeng/api';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {AutoComplete, AutoCompleteCompleteEvent, AutoCompleteSelectEvent} from 'primeng/autocomplete';
import {DatePicker} from 'primeng/datepicker';
import {InputNumber} from 'primeng/inputnumber';
import {Textarea} from 'primeng/textarea';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {Tag} from 'primeng/tag';
import {Avatar} from 'primeng/avatar';
import {BusinessTripPermissionsService} from '../../services/business-trip-permissions.service';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {EmployeesService} from '../../../../organization/employees/services/employees.service';
import {Employee} from '../../../../organization/employees/models/employee.model';
import {BusinessTripService} from '../../services/business-trip.service';
import {LocationService} from '../../services/location.service';
import {BusinessTrip} from '../../models/business-trip.model';
import {Location} from '../../models/location.model';
import {BusinessTripStatus} from '../../enums/business-trip-status.enum';
import {
  BUSINESS_TRIP_STATUS_META,
  employeeInitials,
  isTripClosed,
  toTripApiDate
} from '../../constants/business-trip-labels';

export interface BusinessTripDialogData {
  trip?: BusinessTrip;
}

@Component({
  selector: 'app-business-trip-dialog',
  standalone: true,
  imports: [
    DatePipe, FormsModule, ReactiveFormsModule, PrimeTemplate,
    AutoComplete, DatePicker, InputNumber, Textarea, Button, Message, Tag, Avatar
  ],
  templateUrl: './business-trip-dialog.component.html',
  styleUrl: './business-trip-dialog.component.scss'
})
export class BusinessTripDialogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject<DynamicDialogConfig<BusinessTripDialogData>>(DynamicDialogConfig);
  private readonly fb = inject(FormBuilder);
  private readonly tripService = inject(BusinessTripService);
  private readonly locationService = inject(LocationService);
  private readonly employeesService = inject(EmployeesService);
  private readonly notifications = inject(NotificationService);

  readonly trip = this.config.data?.trip;
  readonly isEdit = !!this.trip;
  readonly initials = employeeInitials;

  readonly form = this.fb.group({
    period: this.fb.control<Date[] | null>(null, Validators.required),
    description: ['', [Validators.required, Validators.maxLength(300)]],
    estimatedBudget: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)])
  });

  readonly locations = signal<Location[]>([]);
  readonly locationSuggestions = signal<Location[]>([]);
  locationQuery: Location | string | null = null;

  readonly participants = signal<Employee[]>([]);
  readonly employeeSuggestions = signal<Employee[]>([]);
  employeeQuery: Employee | string | null = null;

  readonly busyAction = signal<'save' | 'approve' | 'reject' | 'download' | null>(null);
  readonly triedSubmit = signal(false);

  private readonly period = toSignal(this.form.controls.period.valueChanges, {initialValue: null});
  private readonly description = toSignal(this.form.controls.description.valueChanges, {initialValue: ''});

  readonly startDate = computed(() => this.period()?.[0] ?? null);
  readonly endDate = computed(() => this.period()?.[1] ?? null);
  readonly days = computed(() => this.startDate() && this.endDate()
    ? moment(this.endDate()).startOf('day').diff(moment(this.startDate()).startOf('day'), 'days') + 1
    : 0);
  readonly descriptionLength = computed(() => this.description()?.length ?? 0);

  readonly status = this.trip?.status ?? BusinessTripStatus.None;
  readonly statusMeta = BUSINESS_TRIP_STATUS_META[this.status] ?? BUSINESS_TRIP_STATUS_META[BusinessTripStatus.None];
  readonly isClosed = this.isEdit && isTripClosed(this.status);

  private readonly permissions = inject(BusinessTripPermissionsService);
  readonly perm = computed(() => this.trip ? this.permissions.for(this.trip) : null);
  readonly canEdit = computed(() => !this.trip || !!this.perm()?.canEdit);
  readonly isLocked = computed(() => !this.canEdit());
  readonly canApprove = computed(() => !!this.perm()?.canApprove);
  readonly canReject = computed(() => !!this.perm()?.canReject);
  readonly hasDecision = computed(() => this.canApprove() || this.canReject());

  readonly routeError = computed(() => this.locations().length < 2);
  readonly participantsError = computed(() => this.participants().length < 1);

  ngOnInit(): void {
    const trip = this.trip;
    if (!trip) {
      return;
    }

    this.form.reset({
      period: [moment(trip.startDate).toDate(), moment(trip.endDate).toDate()],
      description: trip.description ?? '',
      estimatedBudget: trip.estimatedBudget ?? null
    });
    this.participants.set([...(trip.participants ?? [])]);
    this.locations.set((trip.locations ?? []).map(l => ({
      integrationId: l.locationIntegrationId,
      name: l.name,
      displayName: l.displayName,
      country: l.country,
      countryCode: l.countryCode
    })));

    if (this.isLocked()) {
      this.form.disable();
    }
  }

  searchLocations(event: AutoCompleteCompleteEvent): void {
    this.locationService.searchLocations(event.query)
      .pipe(catchError(() => of([] as Location[])), takeUntil(this.destroy$))
      .subscribe(result => this.locationSuggestions.set(result));
  }

  addLocation(event: AutoCompleteSelectEvent): void {
    const location = event.value as Location;
    if (!this.locations().some(l => l.integrationId === location.integrationId)) {
      this.locations.update(list => [...list, location]);
    }
    setTimeout(() => this.locationQuery = null);
  }

  removeLocation(index: number): void {
    this.locations.update(list => list.filter((_, i) => i !== index));
  }

  moveLocation(index: number, delta: number): void {
    this.locations.update(list => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  stopRole(index: number): 'start' | 'stop' | 'end' {
    const count = this.locations().length;
    if (index === 0) return 'start';
    if (index === count - 1) return 'end';
    return 'stop';
  }

  searchEmployees(event: AutoCompleteCompleteEvent): void {
    this.employeesService.getAllEmployees({searchPattern: event.query})
      .pipe(catchError(() => of([] as Employee[])), takeUntil(this.destroy$))
      .subscribe(result => this.employeeSuggestions.set(result));
  }

  addParticipant(event: AutoCompleteSelectEvent): void {
    const employee = event.value as Employee;
    if (!this.participants().some(e => e.id === employee.id)) {
      this.participants.update(list => [...list, employee]);
    }
    setTimeout(() => this.employeeQuery = null);
  }

  removeParticipant(employee: Employee): void {
    this.participants.update(list => list.filter(e => e.id !== employee.id));
  }

  isParticipant(employee: Employee): boolean {
    return this.participants().some(e => e.id === employee.id);
  }

  save(): void {
    this.triedSubmit.set(true);
    const start = this.startDate();
    const end = this.endDate();

    if (this.form.invalid || !start || !end || this.routeError() || this.participantsError()) {
      this.form.markAllAsTouched();
      return;
    }

    const body = {
      startDate: toTripApiDate(start),
      endDate: toTripApiDate(end),
      description: this.form.value.description ?? '',
      estimatedBudget: this.form.value.estimatedBudget ?? 0,
      employeeIds: this.participants().map(e => e.id),
      locationIntegrationIds: this.locations().map(l => l.integrationId)
    };

    const request$ = this.trip
      ? this.tripService.update({id: this.trip.id, ...body})
      : this.tripService.create(body);

    this.run('save', request$, this.isEdit ? 'Зміни збережено' : 'Відрядження створено');
  }

  approve(): void {
    this.run('approve', this.tripService.approveBusinessTrip(this.trip!.id), 'Відрядження підтверджено');
  }

  reject(): void {
    this.run('reject', this.tripService.rejectBusinessTrip(this.trip!.id), 'Відрядження відхилено');
  }

  download(): void {
    this.busyAction.set('download');
    this.tripService.saveBusinessTripOrderPdf(this.trip!)
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
