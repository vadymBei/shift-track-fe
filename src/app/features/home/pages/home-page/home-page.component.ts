import {Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DecimalPipe, NgTemplateOutlet} from '@angular/common';
import {RouterLink} from '@angular/router';
import {catchError, finalize, of, Subscription} from 'rxjs';
import moment from 'moment';
import 'moment/locale/uk';
import {Button} from 'primeng/button';
import {Tag} from 'primeng/tag';
import {Avatar} from 'primeng/avatar';
import {ProgressBar} from 'primeng/progressbar';
import {Skeleton} from 'primeng/skeleton';
import {Tooltip} from 'primeng/tooltip';
import {AccountService} from '../../../../core/account/services/account.service';
import {MANAGER_ROLES} from '../../../../core/account/constants/default-roles-catalog.constants';
import {Shift} from '../../../organization/timesheet/models/shift.model';
import {ShiftType} from '../../../organization/timesheet/enums/shift-type.enum';
import {shiftMinutes, shortTime} from '../../../organization/timesheet/constants/shift-labels';
import {VACATION_STATUS_META} from '../../../booking/vacations/constants/vacation-labels';
import {VacationStatus} from '../../../booking/vacations/enums/vacation-status.enum';
import {BUSINESS_TRIP_STATUS_META} from '../../../booking/business-trips/constants/business-trip-labels';
import {BusinessTripStatus} from '../../../booking/business-trips/enums/business-trip-status.enum';
import {HomeService} from '../../services/home.service';
import {DayShift, HomeDashboard, MyRequest, MyWeek, PendingApproval, RequestKind, TeamMemberToday, TeamToday} from '../../models/home-dashboard.model';
import {personInitials, pluralUk} from '../../../../shared/utils/text.utils';
import {ShiftChipComponent} from '../../../organization/timesheet/components/shift-chip/shift-chip.component';
import {VacationService} from '../../../booking/vacations/services/vacation.service';
import {VacationBalance} from '../../../booking/vacations/models/vacation-balance.model';

type ShiftState =
  | {kind: 'none'}
  | {kind: 'off'; shift: Shift}
  | {kind: 'upcoming'; shift: Shift; startsIn: string}
  | {kind: 'active'; shift: Shift; progress: number; left: string}
  | {kind: 'done'; shift: Shift};

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [NgTemplateOutlet, ShiftChipComponent, DecimalPipe, RouterLink, Button, Tag, Avatar, ProgressBar, Skeleton, Tooltip],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly homeService = inject(HomeService);
  private readonly accountService = inject(AccountService);
  private readonly vacationService = inject(VacationService);

  readonly shortTime = shortTime;

  readonly data = signal<HomeDashboard | null>(null);
  readonly isLoading = signal(true);
  readonly now = signal(moment());

  readonly user = computed(() => this.accountService.currentUser());
  readonly isManager = computed(() => (this.user()?.roles ?? []).some(r => MANAGER_ROLES.includes(r)));

  readonly greeting = computed(() => {
    const hour = this.now().hour();
    const hello = hour >= 5 && hour < 12 ? 'Доброго ранку'
      : hour >= 12 && hour < 18 ? 'Доброго дня'
        : hour >= 18 && hour < 23 ? 'Доброго вечора' : 'Доброї ночі';
    const name = this.user()?.employee?.name;
    return name ? `${hello}, ${name}` : hello;
  });

  readonly todayLabel = computed(() => this.now().clone().locale('uk').format('dddd, D MMMM'));

  readonly myWeek = signal<MyWeek | null>(null);
  readonly weekLoading = signal(true);
  readonly weekError = signal(false);
  readonly week = computed(() => this.myWeek()?.week ?? []);
  readonly nextShift = computed(() => this.myWeek()?.nextShift ?? null);

  readonly todayShift = computed<DayShift | null>(() => {
    const today = this.now().format('YYYY-MM-DD');
    return this.week().find(d => d.date === today) ?? null;
  });

  readonly shiftState = computed<ShiftState>(() => {
    const day = this.todayShift();
    const shift = day?.shift;
    if (!day || !shift) return {kind: 'none'};
    if (shift.type !== ShiftType.workday || !day.startTime || !day.endTime) return {kind: 'off', shift};

    const now = this.now();
    const start = moment(`${now.format('YYYY-MM-DD')} ${day.startTime}`, 'YYYY-MM-DD HH:mm:ss');
    const end = moment(`${now.format('YYYY-MM-DD')} ${day.endTime}`, 'YYYY-MM-DD HH:mm:ss');
    if (!end.isAfter(start)) end.add(1, 'day');

    if (now.isBefore(start)) return {kind: 'upcoming', shift, startsIn: this.duration(start.diff(now, 'minutes'))};
    if (now.isAfter(end)) return {kind: 'done', shift};
    const total = end.diff(start, 'minutes');
    const passed = now.diff(start, 'minutes');
    return {kind: 'active', shift, progress: Math.round(passed / total * 100), left: this.duration(total - passed)};
  });

  readonly weekHours = computed(() =>
    this.week()
      .filter(d => d.shift?.type === ShiftType.workday)
      .reduce((sum, d) => sum + (shiftMinutes(d.startTime, d.endTime) ?? 0), 0) / 60
  );

  readonly vacationBalance = signal<VacationBalance | null>(null);
  readonly balanceLoading = signal(true);
  readonly balanceError = signal(false);
  private balanceSub?: Subscription;

  readonly balance = computed(() => {
    const b = this.vacationBalance();
    if (!b) return null;
    const available = Math.max(0, b.totalDays - b.usedDays - b.plannedDays);
    const pct = (v: number) => b.totalDays ? v / b.totalDays * 100 : 0;
    const used = Math.min(b.usedDays, b.totalDays);
    const planned = Math.min(b.plannedDays, b.totalDays - used);
    return {...b, available, usedPct: pct(used), plannedPct: pct(planned)};
  });

  readonly department = computed(() => {
    const e = this.user()?.employee;
    const id = e?.departmentId ?? e?.department?.id;
    return id ? {id, name: e?.department?.name ?? 'Мій департамент'} : null;
  });
  readonly team = signal<TeamToday | null>(null);
  readonly teamLoading = signal(false);
  readonly teamError = signal(false);
  readonly teamListLimit = 6;

  readonly teamStats = computed(() => {
    const t = this.team();
    if (!t) return [];
    const names = (list: TeamMemberToday[]) => list.map(m => `${m.fullName} — ${m.shift.description}`).join('\n');
    return [
      {value: t.working.length, label: 'на зміні', tooltip: '', show: true},
      {value: t.vacation.length, label: 'у відпустці', tooltip: names(t.vacation), show: t.vacation.length > 0},
      {value: t.dayOff.length, label: 'вихідний', tooltip: names(t.dayOff), show: t.dayOff.length > 0},
      {value: t.other.length, label: 'інше', tooltip: names(t.other), show: t.other.length > 0},
      {value: t.notPlanned, label: 'без зміни', tooltip: '', show: t.notPlanned > 0}
    ].filter(s => s.show);
  });

  isWorkingNow(member: TeamMemberToday): boolean {
    const {startTime, endTime} = member.shift;
    if (!startTime || !endTime) return false;
    const now = this.now();
    const start = moment(`${now.format('YYYY-MM-DD')} ${startTime}`, 'YYYY-MM-DD HH:mm:ss');
    const end = moment(`${now.format('YYYY-MM-DD')} ${endTime}`, 'YYYY-MM-DD HH:mm:ss');
    if (!end.isAfter(start)) end.add(1, 'day');
    return now.isBetween(start, end, 'minute', '[)');
  }

  isMe(member: TeamMemberToday): boolean {
    return member.employeeId === this.user()?.employee?.id;
  }

  private weekSub?: Subscription;
  private teamSub?: Subscription;

  constructor() {
    effect(() => {
      const employeeId = this.user()?.employee?.id ?? null;
      const manager = this.isManager();
      untracked(() => {
        this.loadWeek(employeeId);
        this.loadBalance(employeeId);
        this.loadDashboard(employeeId, manager);
      });
    });
    effect(() => {
      const departmentId = this.department()?.id ?? null;
      untracked(() => this.loadTeam(departmentId));
    });
  }

  private dashboardSub?: Subscription;

  private loadDashboard(employeeId: number | null, manager: boolean): void {
    this.dashboardSub?.unsubscribe();
    if (!employeeId) {
      return;
    }
    this.isLoading.set(true);
    if (manager) {
      this.homeService.loadPendingCounts(employeeId, true);
    }
    this.dashboardSub = this.homeService.getDashboard(manager)
      .pipe(finalize(() => this.isLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe(data => this.data.set(data));
  }

  private loadBalance(employeeId: number | null): void {
    this.balanceSub?.unsubscribe();
    if (!employeeId) {
      return;
    }
    this.balanceLoading.set(true);
    this.balanceError.set(false);
    this.balanceSub = this.vacationService.getVacationBalanceByEmployeeId(employeeId)
      .pipe(
        catchError(() => {
          this.balanceError.set(true);
          return of(null);
        }),
        finalize(() => this.balanceLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(balance => this.vacationBalance.set(balance));
  }

  private loadWeek(employeeId: number | null): void {
    this.weekSub?.unsubscribe();
    if (!employeeId) {
      return;
    }
    this.weekLoading.set(true);
    this.weekError.set(false);
    this.weekSub = this.homeService.getMyWeek(employeeId)
      .pipe(
        catchError(() => {
          this.weekError.set(true);
          return of(null);
        }),
        finalize(() => this.weekLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(week => this.myWeek.set(week));
  }

  dayRange(day: DayShift | null | undefined): string {
    return day?.startTime && day?.endTime ? `${shortTime(day.startTime)}–${shortTime(day.endTime)}` : '';
  }

  private loadTeam(departmentId: number | null): void {
    this.teamSub?.unsubscribe();
    const department = this.department();
    if (!departmentId || !department) {
      this.team.set(null);
      return;
    }
    this.teamLoading.set(true);
    this.teamError.set(false);
    this.teamSub = this.homeService.getTeamToday(department.id, department.name)
      .pipe(
        catchError(() => {
          this.teamError.set(true);
          return of(null);
        }),
        finalize(() => this.teamLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(team => this.team.set(team));
  }

  readonly pendingVacations = computed(() => this.homeService.pendingCounts().vacations);
  readonly pendingTrips = computed(() => this.homeService.pendingCounts().businessTrips);
  readonly pendingTotal = computed(() => this.pendingVacations() + this.pendingTrips());

  ngOnInit(): void {
    const timer = setInterval(() => this.now.set(moment()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  dayName(date: string): string {
    return moment(date).locale('uk').format('dd');
  }

  dayNumber(date: string): string {
    return moment(date).format('D');
  }

  isToday(date: string): boolean {
    return moment(date).isSame(this.now(), 'day');
  }

  isPast(date: string): boolean {
    return moment(date).isBefore(this.now(), 'day');
  }

  period(start: string, end: string): string {
    const s = moment(start).locale('uk');
    const e = moment(end).locale('uk');
    if (s.isSame(e, 'day')) return s.format('D MMMM');
    if (s.isSame(e, 'month')) return `${s.format('D')} – ${e.format('D MMMM')}`;
    return `${s.format('D MMM')} – ${e.format('D MMM')}`;
  }

  days(start: string, end: string): number {
    return moment(end).diff(moment(start), 'days') + 1;
  }

  relativeDay(date: string): string {
    const diff = moment(date).startOf('day').diff(this.now().clone().startOf('day'), 'days');
    if (diff === 0) return 'сьогодні';
    if (diff === 1) return 'завтра';
    if (diff > 1 && diff < 7) return moment(date).locale('uk').format('dddd');
    return moment(date).locale('uk').format('D MMMM');
  }

  inDays(date: string): string {
    const diff = moment(date).startOf('day').diff(this.now().clone().startOf('day'), 'days');
    return diff <= 0 ? 'вже триває' : `через ${diff} ${this.plural(diff, 'день', 'дні', 'днів')}`;
  }

  submitted(createdAt: string): string {
    return moment(createdAt).locale('uk').fromNow();
  }

  timeRange(shift: Shift | null | undefined): string {
    return shift?.startTime && shift?.endTime ? `${shortTime(shift.startTime)}–${shortTime(shift.endTime)}` : '';
  }

  kindIcon(kind: RequestKind): string {
    return kind === 'vacation' ? 'pi pi-sun' : 'pi pi-briefcase';
  }

  requestStatus(request: MyRequest): {label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'} {
    return request.kind === 'vacation'
      ? VACATION_STATUS_META[request.status as VacationStatus] ?? VACATION_STATUS_META[VacationStatus.None]
      : BUSINESS_TRIP_STATUS_META[request.status as BusinessTripStatus] ?? BUSINESS_TRIP_STATUS_META[BusinessTripStatus.None];
  }

  reviewLink(item: PendingApproval): string {
    return item.kind === 'vacation' ? '/vacations' : '/business-trips';
  }

  initials(fullName: string): string {
    return personInitials(fullName);
  }

  readonly plural = pluralUk;

  private duration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return `${m} хв`;
    return m ? `${h} год ${m} хв` : `${h} год`;
  }
}
