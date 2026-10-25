import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {DatePipe, DecimalPipe} from '@angular/common';
import {toSignal} from '@angular/core/rxjs-interop';
import {FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {catchError, debounceTime, filter, finalize, forkJoin, map, of, startWith, Subject, takeUntil} from 'rxjs';
import moment from 'moment';

import {PrimeTemplate} from 'primeng/api';
import {TableModule} from 'primeng/table';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {SelectButton} from 'primeng/selectbutton';
import {DatePicker} from 'primeng/datepicker';
import {FloatLabel} from 'primeng/floatlabel';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Tag} from 'primeng/tag';
import {Avatar} from 'primeng/avatar';
import {AvatarGroup} from 'primeng/avatargroup';
import {Tooltip} from 'primeng/tooltip';
import {DialogService} from 'primeng/dynamicdialog';

import {ConfirmService} from '../../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {
  TimelineCalendarComponent,
  TimelineItem,
  TimelineLegendItem
} from '../../../../../shared/components/timeline-calendar/timeline-calendar.component';
import {AccountService} from '../../../../../core/account/services/account.service';
import {BusinessTripPermissions, BusinessTripPermissionsService} from '../../services/business-trip-permissions.service';
import {DepartmentService} from '../../../../organization/structure/services/department.service';
import {UnitService} from '../../../../organization/structure/services/unit.service';
import {Unit} from '../../../../organization/structure/models/unit.model';
import {Department} from '../../../../organization/structure/models/department.model';
import {BusinessTripService} from '../../services/business-trip.service';
import {BusinessTrip} from '../../models/business-trip.model';
import {BusinessTripStatus} from '../../enums/business-trip-status.enum';
import {BusinessTripDialogComponent, BusinessTripDialogData} from '../../components/business-trip-dialog/business-trip-dialog.component';
import {
  BUSINESS_TRIP_STATUS_META,
  employeeInitials,
  tripDays,
  tripRoute,
  tripStops
} from '../../constants/business-trip-labels';
import {HomeService} from '../../../../home/services/home.service';
import {EmptyStateComponent} from '../../../../../shared/components/empty-state/empty-state.component';

type ViewMode = 'list' | 'calendar';

@Component({
  selector: 'app-business-trips',
  standalone: true,
  imports: [EmptyStateComponent, 
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    PrimeTemplate,
    TableModule,
    Button,
    Select,
    SelectButton,
    DatePicker,
    FloatLabel,
    IconField,
    InputIcon,
    InputText,
    Tag,
    Avatar,
    AvatarGroup,
    Tooltip,
    TimelineCalendarComponent
  ],
  providers: [DialogService],
  templateUrl: './business-trips.component.html',
  styleUrl: './business-trips.component.scss'
})
export class BusinessTripsComponent implements OnInit, OnDestroy {
  private readonly tripService = inject(BusinessTripService);
  private readonly departmentService = inject(DepartmentService);
  private readonly unitService = inject(UnitService);
  private readonly accountService = inject(AccountService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmService = inject(ConfirmService);
  private readonly homeService = inject(HomeService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<void>();
  private isInitialLoad = true;

  readonly route = tripRoute;
  readonly stops = tripStops;
  readonly days = tripDays;
  readonly initials = employeeInitials;

  readonly viewOptions = [
    {label: 'Список', value: 'list' as ViewMode, icon: 'pi pi-list'},
    {label: 'Календар', value: 'calendar' as ViewMode, icon: 'pi pi-calendar'}
  ];

  readonly statusOptions = [
    {label: 'Усі', value: BusinessTripStatus.None},
    {label: BUSINESS_TRIP_STATUS_META[BusinessTripStatus.PendingApproval].label, value: BusinessTripStatus.PendingApproval},
    {label: BUSINESS_TRIP_STATUS_META[BusinessTripStatus.Approved].label, value: BusinessTripStatus.Approved},
    {label: BUSINESS_TRIP_STATUS_META[BusinessTripStatus.Rejected].label, value: BusinessTripStatus.Rejected}
  ];

  readonly form = this.fb.group({
    unitId: [null as number | null],
    departmentId: [null as number | null],
    status: [BusinessTripStatus.None],
    period: this.fb.control<Date[] | null>([moment().startOf('month').toDate(), moment().endOf('month').startOf('day').toDate()]),
    searchPattern: ['']
  });

  readonly view = signal<ViewMode>('list');
  readonly units = signal<Unit[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly trips = signal<BusinessTrip[]>([]);
  readonly isLoading = signal(false);
  readonly isBulkBusy = signal(false);
  readonly hasScope = signal(false);
  readonly calendarMonth = signal<Date>(moment().startOf('month').toDate());

  selectedTrips: BusinessTrip[] = [];

  private readonly permissions = inject(BusinessTripPermissionsService);
  readonly canDecideOthers = this.permissions.canDecideOthers;

  private readonly statusFilter = toSignal(
    this.form.controls.status.valueChanges.pipe(startWith(this.form.controls.status.value)),
    {initialValue: BusinessTripStatus.None}
  );

  readonly visibleTrips = computed(() => {
    const status = this.statusFilter();
    return !status || status === BusinessTripStatus.None
      ? this.trips()
      : this.trips().filter(t => t.status === status);
  });

  readonly calendarLegend: TimelineLegendItem[] = [
    {label: BUSINESS_TRIP_STATUS_META[BusinessTripStatus.PendingApproval].label, severity: 'warn'},
    {label: BUSINESS_TRIP_STATUS_META[BusinessTripStatus.Approved].label, severity: 'success'},
    {label: BUSINESS_TRIP_STATUS_META[BusinessTripStatus.Rejected].label, severity: 'danger'}
  ];

  readonly calendarItems = computed<TimelineItem<BusinessTrip>[]>(() => this.visibleTrips().flatMap(trip => {
    const meta = this.statusMeta(trip);
    const route = tripRoute(trip);
    return (trip.participants ?? []).map(employee => ({
      id: `${trip.id}-${employee.id}`,
      rowKey: employee.id,
      rowLabel: employee.fullName,
      rowInitials: employeeInitials(employee),
      start: trip.startDate,
      end: trip.endDate,
      label: route,
      tooltip: `${route}: ${moment(trip.startDate).format('DD.MM')} – ${moment(trip.endDate).format('DD.MM.YYYY')} · ${meta.label}`,
      severity: meta.severity === 'secondary' ? 'secondary' : meta.severity,
      countInTotals: trip.status !== BusinessTripStatus.Rejected,
      data: trip
    }));
  }));

  ngOnInit(): void {
    this.applyQueryParams();
    this.watchOpenParam();

    this.search$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.loadTrips());

    this.unitService.getUnitsByRoles()
      .pipe(catchError(() => of([] as Unit[])), takeUntil(this.destroy$))
      .subscribe(units => {
        this.units.set(units);

        const userUnitId = this.accountService.currentUser()?.employee?.department?.unit?.id;
        if (this.isInitialLoad && userUnitId && units.some(u => u.id === userUnitId)) {
          this.form.patchValue({unitId: userUnitId}, {emitEvent: false});
          this.loadDepartments(userUnitId);
        } else {
          this.isInitialLoad = false;
        }
      });
  }

  private watchOpenParam(): void {
    this.activatedRoute.queryParamMap
      .pipe(
        map(params => Number(params.get('open'))),
        filter(id => Number.isInteger(id) && id > 0),
        takeUntil(this.destroy$)
      )
      .subscribe(id => {
        this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {open: null}, queryParamsHandling: 'merge', replaceUrl: true});
        this.tripService.getById(id)
          .pipe(catchError(() => {
            this.notifications.warn('Відрядження не знайдено або воно вам недоступне');
            return of(null);
          }), takeUntil(this.destroy$))
          .subscribe(trip => trip && this.openDialog(trip));
      });
  }

  private applyQueryParams(): void {
    const params = this.activatedRoute.snapshot.queryParamMap;
    const status = params.get('status') as BusinessTripStatus | null;
    if (status && Object.values(BusinessTripStatus).includes(status)) {
      this.form.patchValue({status});
    }
    if (params.get('create')) {
      this.router.navigate([], {relativeTo: this.activatedRoute, queryParams: {create: null}, queryParamsHandling: 'merge', replaceUrl: true});
      setTimeout(() => this.openDialog());
    }
  }

  onUnitChange(unitId: number | null): void {
    this.isInitialLoad = false;
    this.form.patchValue({departmentId: null}, {emitEvent: false});
    this.departments.set([]);
    this.trips.set([]);
    this.selectedTrips = [];
    this.hasScope.set(false);

    if (unitId !== null && unitId !== undefined) {
      this.loadDepartments(unitId);
    }
  }

  private loadDepartments(unitId: number): void {
    this.departmentService.getDepartmentsByRoles(unitId)
      .pipe(catchError(() => of([] as Department[])), takeUntil(this.destroy$))
      .subscribe(departments => {
        this.departments.set(departments);

        const userDepartmentId = this.accountService.currentUser()?.employee?.departmentId;
        if (this.isInitialLoad && userDepartmentId && departments.some(d => d.id === userDepartmentId)) {
          this.form.patchValue({departmentId: userDepartmentId}, {emitEvent: false});
          this.loadTrips();
        }
        this.isInitialLoad = false;
      });
  }

  onFiltersChange(): void {
    this.loadTrips();
  }

  onPeriodChange(): void {
    const [start, end] = this.form.value.period ?? [];
    if (start && end) {
      this.loadTrips();
    }
  }

  onSearchInput(): void {
    this.search$.next();
  }

  onViewChange(view: ViewMode | null): void {
    if (!view || view === this.view()) {
      return;
    }
    this.view.set(view);
    if (view === 'calendar') {
      this.setCalendarMonth(this.form.value.period?.[0] ?? new Date());
    }
  }

  onCalendarMonthChange(month: Date): void {
    this.setCalendarMonth(month);
  }

  private setCalendarMonth(date: Date): void {
    const start = moment(date).startOf('month');
    this.calendarMonth.set(start.toDate());
    this.form.patchValue({period: [start.toDate(), start.clone().endOf('month').startOf('day').toDate()]}, {emitEvent: false});
    this.loadTrips();
  }

  loadTrips(): void {
    const {departmentId, period, searchPattern} = this.form.getRawValue();
    this.selectedTrips = [];

    if (departmentId === null || departmentId === undefined) {
      this.hasScope.set(false);
      this.trips.set([]);
      return;
    }
    this.hasScope.set(true);

    const start = period?.[0] ?? moment().startOf('month').toDate();
    const end = period?.[1] ?? start;

    this.isLoading.set(true);
    this.tripService.getFiltered({
      departmentId,
      searchPattern: searchPattern ?? '',
      startDate: moment(start).format('YYYY-MM-DD') as unknown as Date,
      endDate: moment(end).format('YYYY-MM-DD') as unknown as Date
    })
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(trips => this.trips.set(trips));
  }

  readonly isRowSelectable = (event: {data: BusinessTrip}) => {
    const p = this.perms(event.data);
    return this.canDecideOthers() && (p.canApprove || p.canReject);
  };

  perms(trip: BusinessTrip): BusinessTripPermissions {
    return this.permissions.for(trip);
  }

  statusMeta(trip: BusinessTrip) {
    return BUSINESS_TRIP_STATUS_META[trip.status] ?? BUSINESS_TRIP_STATUS_META[BusinessTripStatus.None];
  }

  participantsTooltip(trip: BusinessTrip): string {
    return (trip.participants ?? []).map(p => p.fullName).join('\n');
  }

  get selectedSummary(): string {
    const count = this.selectedTrips.length;
    const word = count === 1 ? 'відрядження' : 'відряджень';
    const people = new Set(this.selectedTrips.flatMap(t => t.participants.map(p => p.id))).size;
    return `Обрано ${count} ${word} · ${people} учасн.`;
  }

  approveSelected(): void {
    this.runBulk('approve');
  }

  rejectSelected(): void {
    this.confirmService.confirm({
      header: 'Відхилити відрядження',
      message: `Відхилити обрані відрядження (${this.selectedTrips.length})?`,
      acceptLabel: 'Відхилити',
      acceptSeverity: 'danger',
      icon: 'pi pi-times-circle',
      onConfirm: () => this.runBulk('reject')
    });
  }

  private runBulk(action: 'approve' | 'reject'): void {
    const items = this.selectedTrips.filter(t => action === 'approve' ? this.perms(t).canApprove : this.perms(t).canReject);
    if (!items.length) {
      this.notifications.warn('Серед обраних немає відряджень, які можна обробити');
      return;
    }

    const call = (t: BusinessTrip) => action === 'approve'
      ? this.tripService.approveBusinessTrip(t.id)
      : this.tripService.rejectBusinessTrip(t.id);

    this.isBulkBusy.set(true);
    forkJoin(items.map(t => call(t).pipe(map(() => true), catchError(() => of(false)))))
      .pipe(finalize(() => this.isBulkBusy.set(false)), takeUntil(this.destroy$))
      .subscribe(results => {
        const ok = results.filter(Boolean).length;
        const failed = results.length - ok;
        if (ok) {
          this.notifications.success(`${action === 'approve' ? 'Підтверджено' : 'Відхилено'} відряджень: ${ok}`);
        }
        if (failed) {
          this.notifications.warn(`Не вдалося обробити відряджень: ${failed}`);
        }
        this.reloadAfterChange();
      });
  }

  openDialog(trip?: BusinessTrip): void {
    if (trip && !this.perms(trip).canView) {
      return;
    }
    const ref = this.dialogService.open(BusinessTripDialogComponent, {
      showHeader: false,
      modal: true,
      width: '880px',
      breakpoints: {'920px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data: {trip} satisfies BusinessTripDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.reloadAfterChange());
  }

  download(trip: BusinessTrip): void {
    this.tripService.saveBusinessTripOrderPdf(trip)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  confirmDelete(trip: BusinessTrip): void {
    this.confirmService.confirmDelete({
      entityName: 'відрядження за маршрутом',
      itemName: tripRoute(trip),
      onConfirm: () => this.tripService.delete(trip.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Відрядження видалено');
          this.reloadAfterChange();
        })
    });
  }

  private reloadAfterChange(): void {
    this.loadTrips();
    this.homeService.refreshPendingCounts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
