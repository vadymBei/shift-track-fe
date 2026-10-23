import {inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, forkJoin, map, Observable, of} from 'rxjs';
import moment from 'moment';
import {ShiftType} from '../../organization/timesheet/enums/shift-type.enum';
import {VacationStatus} from '../../booking/vacations/enums/vacation-status.enum';
import {BusinessTripStatus} from '../../booking/business-trips/enums/business-trip-status.enum';
import {VACATION_TYPE_LABELS} from '../../booking/vacations/constants/vacation-labels';
import {
  BookingRequestResponse,
  DayShift,
  HomeDashboard,
  MyRequest,
  MyRequestsResponse,
  MyWeek,
  PendingApproval,
  PendingApprovalResponse,
  PendingApprovalsCount,
  RequestKind,
  TeamMemberToday,
  TeamToday
} from '../models/home-dashboard.model';
import {EmployeeShiftService} from '../../organization/timesheet/services/employee-shift-service';
import {EmployeeShift} from '../../organization/timesheet/models/employee-shift.model';
import {TimesheetService} from '../../organization/timesheet/services/timesheet-service';
import {Timesheet} from '../../organization/timesheet/models/timesheet-model';

const LIST_SIZE = 5;
const EMPTY_COUNTS: PendingApprovalsCount = {vacations: 0, businessTrips: 0};

@Injectable({providedIn: 'root'})
export class HomeService {
  private readonly http = inject(HttpClient);
  private readonly timesheetService = inject(TimesheetService);
  private readonly employeeShiftService = inject(EmployeeShiftService);

  readonly pendingCounts = signal<PendingApprovalsCount>(EMPTY_COUNTS);

  getDashboard(withApprovals: boolean): Observable<HomeDashboard> {
    const my$ = this.http
      .get<MyRequestsResponse>('booking/requests/my', {params: {take: LIST_SIZE}})
      .pipe(catchError(() => of<MyRequestsResponse>({upcomingAbsence: null, items: []})));

    const pending$ = withApprovals
      ? this.http
        .get<PendingApprovalResponse[]>('booking/approvals/pending', {params: {take: LIST_SIZE}})
        .pipe(catchError(() => of<PendingApprovalResponse[]>([])))
      : of<PendingApprovalResponse[]>([]);

    return forkJoin({my: my$, pending: pending$}).pipe(
      map(({my, pending}) => ({
        upcomingAbsence: my?.upcomingAbsence
          ? {
            kind: toKind(my.upcomingAbsence.kind),
            title: requestTitle(my.upcomingAbsence),
            startDate: my.upcomingAbsence.startDate,
            endDate: my.upcomingAbsence.endDate
          }
          : null,
        myRequests: (my?.items ?? []).map(toMyRequest),
        pendingApprovals: (pending ?? []).map(toPendingApproval)
      }))
    );
  }

  getMyWeek(employeeId: number): Observable<MyWeek> {
    const today = moment().startOf('day');
    const monday = today.clone().isoWeekday(1);
    const to = moment.max(monday.clone().add(6, 'day'), today.clone().add(21, 'day'));
    return this.employeeShiftService
      .getByEmployeeId(employeeId, monday.format('YYYY-MM-DD'), to.format('YYYY-MM-DD'))
      .pipe(map(shifts => buildMyWeek(shifts ?? [], monday, today)));
  }

  getTeamToday(departmentId: number, departmentName: string): Observable<TeamToday> {
    const today = moment();
    return this.timesheetService
      .getTimesheet({departmentId, period: today.format('YYYY-MM') as unknown as Date})
      .pipe(map(sheet => buildTeamToday(sheet, departmentName, today)));
  }

  private pendingCountsFor: number | null = null;

  refreshPendingCounts(): void {
    if (this.pendingCountsFor !== null) {
      this.loadPendingCounts(this.pendingCountsFor, true);
    }
  }

  loadPendingCounts(userId: number, force = false): void {
    if (!force && this.pendingCountsFor === userId) return;
    this.pendingCountsFor = userId;
    this.http.get<PendingApprovalsCount>('booking/approvals/pending/count')
      .pipe(catchError(() => of(EMPTY_COUNTS)))
      .subscribe(counts => this.pendingCounts.set(counts ?? EMPTY_COUNTS));
  }
}

function toKind(kind: string): RequestKind {
  return kind?.toLowerCase() === 'businesstrip' ? 'businessTrip' : 'vacation';
}

function requestTitle(item: {kind: string; vacationType: string | null; route: string | null}): string {
  if (toKind(item.kind) === 'businessTrip') {
    return item.route || 'Відрядження';
  }
  return (item.vacationType && VACATION_TYPE_LABELS[item.vacationType as keyof typeof VACATION_TYPE_LABELS]) || 'Відпустка';
}

function toMyRequest(item: BookingRequestResponse): MyRequest {
  return {
    id: item.id,
    kind: toKind(item.kind),
    title: requestTitle(item),
    startDate: item.startDate,
    endDate: item.endDate,
    status: item.status as VacationStatus | BusinessTripStatus,
    createdAt: item.createdAt
  };
}

function toPendingApproval(item: PendingApprovalResponse): PendingApproval {
  const others = Math.max((item.participantsCount ?? 1) - 1, 0);
  const name = item.employee?.fullName ?? 'Без учасників';
  return {
    id: item.id,
    kind: toKind(item.kind),
    employee: {
      id: item.employee?.id ?? 0,
      fullName: others ? `${name} +${others}` : name,
      positionName: item.employee?.positionName ?? null
    },
    title: requestTitle(item),
    startDate: item.startDate,
    endDate: item.endDate,
    createdAt: item.createdAt
  };
}


function buildTeamToday(sheet: Timesheet, departmentName: string, today: moment.Moment): TeamToday {
  const team: TeamToday = {departmentName, total: 0, working: [], vacation: [], dayOff: [], other: [], notPlanned: 0};
  for (const row of sheet?.employeeTimesheets ?? []) {
    team.total++;
    const todayShift = row.employeeShifts.find(s => s?.date && moment(s.date).isSame(today, 'day'))?.shift;
    if (!todayShift) {
      team.notPlanned++;
      continue;
    }
    const member: TeamMemberToday = {employeeId: row.employee.id, fullName: row.employee.fullName, shift: todayShift};
    switch (todayShift.type) {
      case ShiftType.workday: team.working.push(member); break;
      case ShiftType.vacation: team.vacation.push(member); break;
      case ShiftType.dayOff:
      case ShiftType.holiday: team.dayOff.push(member); break;
      default: team.other.push(member);
    }
  }
  team.working.sort((a, b) => (a.shift.startTime ?? '').localeCompare(b.shift.startTime ?? '')
    || a.fullName.localeCompare(b.fullName, 'uk'));
  return team;
}

function toDayShift(date: moment.Moment, es: EmployeeShift | undefined): DayShift {
  return {
    date: date.format('YYYY-MM-DD'),
    shift: es?.shift ?? null,
    startTime: es?.startTime ?? es?.shift?.startTime ?? null,
    endTime: es?.endTime ?? es?.shift?.endTime ?? null
  };
}

function buildMyWeek(shifts: EmployeeShift[], monday: moment.Moment, today: moment.Moment): MyWeek {
  const byDate = new Map<string, EmployeeShift>();
  for (const es of shifts) {
    if (es?.date) byDate.set(moment(es.date).format('YYYY-MM-DD'), es);
  }

  const week = Array.from({length: 7}, (_, i) => {
    const date = monday.clone().add(i, 'day');
    return toDayShift(date, byDate.get(date.format('YYYY-MM-DD')));
  });

  const next = [...byDate.entries()]
    .filter(([date, es]) => moment(date).isAfter(today, 'day') && es.shift?.type === ShiftType.workday)
    .sort(([a], [b]) => a.localeCompare(b))[0];

  return {week, nextShift: next ? toDayShift(moment(next[0]), next[1]) : null};
}
