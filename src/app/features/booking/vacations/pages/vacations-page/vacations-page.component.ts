import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {DatePipe} from '@angular/common';
import {FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {catchError, debounceTime, filter, finalize, forkJoin, map, of, Subject, takeUntil} from 'rxjs';
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
import {Tooltip} from 'primeng/tooltip';
import {DialogService} from 'primeng/dynamicdialog';

import {ConfirmService} from '../../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {AccountService} from '../../../../../core/account/services/account.service';
import {DepartmentService} from '../../../../organization/structure/services/department.service';
import {UnitService} from '../../../../organization/structure/services/unit.service';
import {Unit} from '../../../../organization/structure/models/unit.model';
import {Department} from '../../../../organization/structure/models/department.model';
import {isVacationDecision, Vacation, VacationPermissions, vacationPermissions} from '../../models/vacation.model';
import {VacationStatus} from '../../enums/vacation-status.enum';
import {VacationService} from '../../services/vacation.service';
import {AllVacationsRequest} from '../../models/all-vacations-request.model';
import {CreateVacationModalComponent} from '../../components/create-vacation-modal/create-vacation-modal.component';
import {EditVacationDialogData, EditVacationModalComponent} from '../../components/edit-vacation-modal/edit-vacation-modal.component';
import {
  TimelineCalendarComponent,
  TimelineItem,
  TimelineLegendItem
} from '../../../../../shared/components/timeline-calendar/timeline-calendar.component';
import {
  pluralDays,
  toApiDate,
  VACATION_STATUS_FILTER_OPTIONS,
  VACATION_STATUS_META,
  VACATION_TYPE_LABELS
} from '../../constants/vacation-labels';
import {personInitials} from '../../../../../shared/utils/text.utils';
import {HomeService} from '../../../../home/services/home.service';
import {EmptyStateComponent} from '../../../../../shared/components/empty-state/empty-state.component';

type ViewMode = 'list' | 'calendar';

@Component({
  selector: 'app-vacations-page',
  standalone: true,
  imports: [EmptyStateComponent, 
    DatePipe,
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
    Tooltip,
    TimelineCalendarComponent
  ],
  providers: [DialogService],
  templateUrl: './vacations-page.component.html',
  styleUrl: './vacations-page.component.scss'
})
export class VacationsPageComponent implements OnInit, OnDestroy {
  private readonly departmentService = inject(DepartmentService);
  private readonly vacationService = inject(VacationService);
  private readonly unitService = inject(UnitService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmService = inject(ConfirmService);
  private readonly homeService = inject(HomeService);
  private readonly notifications = inject(NotificationService);
  private readonly accountService = inject(AccountService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<void>();
  private isInitialLoad = true;

  readonly statusOptions = VACATION_STATUS_FILTER_OPTIONS;
  readonly viewOptions = [
    {label: 'Список', value: 'list' as ViewMode, icon: 'pi pi-list'},
    {label: 'Календар', value: 'calendar' as ViewMode, icon: 'pi pi-calendar'}
  ];

  readonly form = this.fb.group({
    unitId: [null as number | null],
    departmentId: [null as number | null],
    status: [VacationStatus.None],
    period: this.fb.control<Date[] | null>([moment().startOf('month').toDate(), moment().endOf('month').startOf('day').toDate()]),
    searchPattern: ['']
  });

  readonly view = signal<ViewMode>('list');
  readonly units = signal<Unit[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly vacations = signal<Vacation[]>([]);
  readonly isLoading = signal(false);
  readonly isBulkBusy = signal(false);
  readonly calendarMonth = signal<Date>(moment().startOf('month').toDate());

  readonly calendarLegend: TimelineLegendItem[] = [
    VacationStatus.PendingApproval,
    VacationStatus.ApprovedByDepartmentDirector,
    VacationStatus.ApprovedByUnitDirector,
    VacationStatus.Rejected
  ].map(status => ({label: VACATION_STATUS_META[status].label, severity: this.toTimelineSeverity(status)}));

  readonly calendarItems = computed<TimelineItem<Vacation>[]>(() => this.vacations().map(vacation => {
    const status = VACATION_STATUS_META[vacation.status] ?? VACATION_STATUS_META[VacationStatus.None];
    return {
      id: vacation.id,
      rowKey: vacation.employee.id,
      rowLabel: vacation.employee.fullName,
      rowInitials: this.initials(vacation),
      start: vacation.startDate,
      end: vacation.endDate,
      label: pluralDays(vacation.daysCount),
      tooltip: `${this.typeLabel(vacation)}: ${moment(vacation.startDate).format('DD.MM')} – ${moment(vacation.endDate).format('DD.MM.YYYY')} · ${status.label}`,
      severity: this.toTimelineSeverity(vacation.status),
      countInTotals: vacation.status !== VacationStatus.Rejected,
      data: vacation
    };
  }));

  selectedVacations: Vacation[] = [];

  readonly hasScope = signal(false);

  ngOnInit(): void {
    this.applyQueryParams();
    this.watchOpenParam();

    this.search$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.loadVacations());

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

  private applyQueryParams(): void {
    const params = this.route.snapshot.queryParamMap;
    const status = params.get('status') as VacationStatus | null;
    if (status && Object.values(VacationStatus).includes(status)) {
      this.form.patchValue({status}, {emitEvent: false});
    }
    if (params.get('create')) {
      this.router.navigate([], {relativeTo: this.route, queryParams: {create: null}, queryParamsHandling: 'merge', replaceUrl: true});
      setTimeout(() => this.openCreate());
    }
  }

  private watchOpenParam(): void {
    this.route.queryParamMap
      .pipe(
        map(params => Number(params.get('open'))),
        filter(id => Number.isInteger(id) && id > 0),
        takeUntil(this.destroy$)
      )
      .subscribe(id => {
        this.router.navigate([], {relativeTo: this.route, queryParams: {open: null}, queryParamsHandling: 'merge', replaceUrl: true});
        this.vacationService.getVacationById(id)
          .pipe(catchError(() => {
            this.notifications.warn('Заявку не знайдено або вона вам недоступна');
            return of(null);
          }), takeUntil(this.destroy$))
          .subscribe(vacation => vacation && this.openEdit(vacation));
      });
  }

  onUnitChange(unitId: number | null): void {
    this.isInitialLoad = false;
    this.form.patchValue({departmentId: null}, {emitEvent: false});
    this.departments.set([]);
    this.vacations.set([]);
    this.selectedVacations = [];
    this.hasScope.set(false);

    if (unitId === null || unitId === undefined) {
      return;
    }

    this.loadDepartments(unitId);
  }

  private loadDepartments(unitId: number): void {
    this.departmentService.getDepartmentsByRoles(unitId)
      .pipe(catchError(() => of([] as Department[])), takeUntil(this.destroy$))
      .subscribe(departments => {
        this.departments.set(departments);

        const userDepartmentId = this.accountService.currentUser()?.employee?.departmentId;
        if (this.isInitialLoad && userDepartmentId && departments.some(d => d.id === userDepartmentId)) {
          this.form.patchValue({departmentId: userDepartmentId}, {emitEvent: false});
          this.loadVacations();
        }
        this.isInitialLoad = false;
      });
  }

  onFiltersChange(): void {
    this.loadVacations();
  }

  onPeriodChange(): void {
    const [start, end] = this.form.value.period ?? [];
    if (start && end) {
      this.loadVacations();
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
      const start = this.form.value.period?.[0] ?? new Date();
      this.setCalendarMonth(start);
    }
  }

  onCalendarMonthChange(month: Date): void {
    this.setCalendarMonth(month);
  }

  private setCalendarMonth(date: Date): void {
    const start = moment(date).startOf('month');
    this.calendarMonth.set(start.toDate());
    this.form.patchValue({period: [start.toDate(), start.clone().endOf('month').startOf('day').toDate()]}, {emitEvent: false});
    this.loadVacations();
  }

  loadVacations(): void {
    const {unitId, departmentId, status, period, searchPattern} = this.form.getRawValue();
    this.selectedVacations = [];

    if (unitId === null || departmentId === null) {
      this.hasScope.set(false);
      this.vacations.set([]);
      return;
    }
    this.hasScope.set(true);

    const request: AllVacationsRequest = {
      unitId,
      departmentId,
      vacationStatus: status ?? VacationStatus.None,
      searchPattern: searchPattern ?? '',
      startDate: period?.[0] ? toApiDate(period[0]) as unknown as Date : undefined,
      endDate: period?.[1] ? toApiDate(period[1]) as unknown as Date : undefined
    };

    this.isLoading.set(true);
    this.vacationService.getVacations(request)
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(vacations => this.vacations.set(vacations));
  }

  readonly canDecideOthers = computed(() => this.vacations().some(v => isVacationDecision(vacationPermissions(v))));

  perms(vacation: Vacation): VacationPermissions {
    return vacationPermissions(vacation);
  }

  readonly isRowSelectable = (event: {data: Vacation}) => isVacationDecision(vacationPermissions(event.data));

  typeLabel(vacation: Vacation): string {
    return VACATION_TYPE_LABELS[vacation.type] ?? 'Відпустка';
  }

  statusMeta(vacation: Vacation) {
    return VACATION_STATUS_META[vacation.status] ?? VACATION_STATUS_META[VacationStatus.None];
  }

  initials(vacation: Vacation): string {
    return personInitials(vacation.employee);
  }

  get selectedSummary(): string {
    const count = this.selectedVacations.length;
    const days = this.selectedVacations.reduce((sum, v) => sum + (v.daysCount ?? 0), 0);
    const word = count === 1 ? 'заявку' : count >= 2 && count <= 4 ? 'заявки' : 'заявок';
    return `Обрано ${count} ${word} · ${pluralDays(days)}`;
  }

  private toTimelineSeverity(status: VacationStatus): TimelineItem['severity'] {
    const severity = VACATION_STATUS_META[status]?.severity;
    return severity === 'warn' || severity === 'info' || severity === 'success' || severity === 'danger' ? severity : 'secondary';
  }

  approveSelected(): void {
    this.runBulk('approve');
  }

  rejectSelected(): void {
    const count = this.selectedVacations.length;
    this.confirmService.confirm({
      header: 'Відхилити заявки',
      message: `Відхилити обрані заявки (${count})? Працівники побачать статус «Відхилено».`,
      acceptLabel: 'Відхилити',
      acceptSeverity: 'danger',
      icon: 'pi pi-times-circle',
      onConfirm: () => this.runBulk('reject')
    });
  }

  private runBulk(action: 'approve' | 'reject'): void {
    const items = this.selectedVacations.filter(v => action === 'approve' ? this.perms(v).canApprove : this.perms(v).canReject);
    if (!items.length) {
      return;
    }

    const call = (v: Vacation) => action === 'approve'
      ? this.vacationService.approveVacation(v.id)
      : this.vacationService.rejectVacation(v.id);

    this.isBulkBusy.set(true);
    forkJoin(items.map(v => call(v).pipe(map(() => true), catchError(() => of(false)))))
      .pipe(finalize(() => this.isBulkBusy.set(false)), takeUntil(this.destroy$))
      .subscribe(results => {
        const ok = results.filter(Boolean).length;
        const failed = results.length - ok;
        const verb = action === 'approve' ? 'Погоджено' : 'Відхилено';
        if (ok) {
          this.notifications.success(`${verb} заявок: ${ok}`);
        }
        if (failed) {
          this.notifications.warn(`Не вдалося обробити заявок: ${failed}`);
        }
        this.reloadAfterChange();
      });
  }

  openCreate(): void {
    const ref = this.dialogService.open(CreateVacationModalComponent, {
      showHeader: false,
      modal: true,
      width: '780px',
      breakpoints: {'820px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.reloadAfterChange());
  }

  openEdit(vacation: Vacation): void {
    if (!this.perms(vacation).canView) {
      return;
    }
    const ref = this.dialogService.open(EditVacationModalComponent, {
      showHeader: false,
      modal: true,
      width: '820px',
      breakpoints: {'860px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data: {vacation} satisfies EditVacationDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.reloadAfterChange());
  }

  download(vacation: Vacation): void {
    this.vacationService.saveVacationRequestPdf(vacation)
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  confirmDelete(vacation: Vacation): void {
    this.confirmService.confirmDelete({
      entityName: 'відпустку працівника',
      itemName: vacation.employee.fullName,
      onConfirm: () => this.vacationService.deleteVacation(vacation.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Заявку видалено');
          this.reloadAfterChange();
        })
    });
  }

  private reloadAfterChange(): void {
    this.loadVacations();
    this.homeService.refreshPendingCounts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
