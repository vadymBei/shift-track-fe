import {Component, computed, DestroyRef, effect, inject, OnInit, signal, untracked} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {DecimalPipe, DatePipe, NgTemplateOutlet} from '@angular/common';
import {RouterLink} from '@angular/router';
import {catchError, finalize, of, Subscription} from 'rxjs';
import {addDays, differenceInCalendarDays, differenceInMinutes, format, formatDistanceToNowStrict, isAfter, isBefore, isSameDay, isSameMonth, startOfDay, startOfMinute} from 'date-fns';
import {atTime, daysInclusive, formatDate, toApiDate, toDate} from '../../../../shared/utils/date.utils';
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

/** Start and end of a shift on the given day; a shift ending at or before its start ends the next day. */
function shiftWindow(day: Date, startTime: string, endTime: string): {start: Date; end: Date} {
  const start = atTime(day, startTime);
  const end = atTime(day, endTime);
  return {start, end: isAfter(end, start) ? end : addDays(end, 1)};
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [NgTemplateOutlet, ShiftChipComponent, DecimalPipe, DatePipe, RouterLink, Button, Tag, Avatar, ProgressBar, Skeleton, Tooltip],
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
  readonly now = signal(new Date());

  readonly user = computed(() => this.accountService.currentUser());
  readonly isManager = computed(() => (this.user()?.roles ?? []).some(r => MANAGER_ROLES.includes(r)));

  readonly greeting = computed(() => {
    const hour = this.now().getHours();
    const hello = hour >= 5 && hour < 12 ? 'Доброго ранку'
      : hour >= 12 && hour < 18 ? 'Доброго дня'
        : hour >= 18 && hour < 23 ? 'Доброго вечора' : 'Доброї ночі';
    const name = this.user()?.employee?.name;
    return name ? `${hello}, ${name}` : hello;
  });

  readonly todayLabel = computed(() => format(this.now(), 'EEEE, d MMMM'));

  readonly myWeek = signal<MyWeek | null>(null);
  readonly weekLoading = signal(true);
  readonly weekError = signal(false);
  readonly week = computed(() => this.myWeek()?.week ?? []);
  readonly nextShift = computed(() => this.myWeek()?.nextShift ?? null);

  readonly todayShift = computed<DayShift | null>(() => {
    const today = toApiDate(this.now());
    return this.week().find(d => d.date === today) ?? null;
  });

  readonly shiftState = computed<ShiftState>(() => {
    const day = this.todayShift();
    const shift = day?.shift;
    if (!day || !shift) return {kind: 'none'};
    if (shift.type !== ShiftType.workday || !day.startTime || !day.endTime) return {kind: 'off', shift};

    const now = this.now();
    const {start, end} = shiftWindow(now, day.startTime, day.endTime);

    if (isBefore(now, start)) return {kind: 'upcoming', shift, startsIn: this.duration(differenceInMinutes(start, now))};
    if (isAfter(now, end)) return {kind: 'done', shift};
    const total = differenceInMinutes(end, start);
    const passed = differenceInMinutes(now, start);
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
    // Only whole days can be requested, the fractional part keeps accruing.
    const available = Math.max(0, Math.floor(b.availableDays));
    const pct = (v: number) => b.totalDays ? v / b.totalDays * 100 : 0;
    const used = Math.min(b.usedDays, b.totalDays);
    const planned = Math.min(b.plannedDays, b.totalDays - used);
    const accrued = Number(b.totalDays.toFixed(2)).toLocaleString('uk-UA');
    // Annual vacation can't start before 6 months of continuous work (art. 10 of the Law "On Vacations").
    const availableFrom = startOfDay(toDate(b.annualVacationAvailableFrom));
    const availableFromDate = differenceInCalendarDays(availableFrom, new Date()) > 0 ? availableFrom : null;
    return {...b, available, accrued, availableFromDate, usedPct: pct(used), plannedPct: pct(planned)};
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
    const now = startOfMinute(this.now());
    const {start, end} = shiftWindow(now, startTime, endTime);
    return !isBefore(now, start) && isBefore(now, end);
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
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  dayName(date: string): string {
    return formatDate(date, 'EEEEEE');
  }

  dayNumber(date: string): string {
    return formatDate(date, 'd');
  }

  isToday(date: string): boolean {
    return isSameDay(toDate(date), this.now());
  }

  isPast(date: string): boolean {
    return differenceInCalendarDays(toDate(date), this.now()) < 0;
  }

  period(start: string, end: string): string {
    const s = toDate(start);
    const e = toDate(end);
    if (isSameDay(s, e)) return format(s, 'd MMMM');
    if (isSameMonth(s, e)) return `${format(s, 'd')} – ${format(e, 'd MMMM')}`;
    return `${format(s, 'd MMM')} – ${format(e, 'd MMM')}`;
  }

  days(start: string, end: string): number {
    return daysInclusive(start, end);
  }

  relativeDay(date: string): string {
    const diff = differenceInCalendarDays(toDate(date), this.now());
    if (diff === 0) return 'сьогодні';
    if (diff === 1) return 'завтра';
    if (diff > 1 && diff < 7) return formatDate(date, 'EEEE');
    return formatDate(date, 'd MMMM');
  }

  inDays(date: string): string {
    const diff = differenceInCalendarDays(toDate(date), this.now());
    return diff <= 0 ? 'вже триває' : `через ${diff} ${this.plural(diff, 'день', 'дні', 'днів')}`;
  }

  submitted(createdAt: string): string {
    return formatDistanceToNowStrict(toDate(createdAt), {addSuffix: true});
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
