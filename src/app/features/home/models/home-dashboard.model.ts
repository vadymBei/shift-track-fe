import {Shift} from '../../organization/timesheet/models/shift.model';
import {VacationStatus} from '../../booking/vacations/enums/vacation-status.enum';
import {BusinessTripStatus} from '../../booking/business-trips/enums/business-trip-status.enum';
import {VacationType} from '../../booking/vacations/enums/vacation-type.enum';

export type RequestKind = 'vacation' | 'businessTrip';

export interface DayShift {
  date: string;
  shift: Shift | null;
  startTime?: string | null;
  endTime?: string | null;
}

export interface MyWeek {
  week: DayShift[];
  nextShift: DayShift | null;
}


export interface UpcomingAbsence {
  kind: RequestKind;
  title: string;
  startDate: string;
  endDate: string;
}

export interface MyRequest {
  id: number;
  kind: RequestKind;
  title: string;
  startDate: string;
  endDate: string;
  status: VacationStatus | BusinessTripStatus;
  createdAt: string;
}

export interface PendingApproval {
  id: number;
  kind: RequestKind;
  employee: {id: number; fullName: string; positionName?: string | null};
  title: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface TeamMemberToday {
  employeeId: number;
  fullName: string;
  shift: Shift;
}

export interface TeamToday {
  departmentName: string;
  total: number;
  working: TeamMemberToday[];
  vacation: TeamMemberToday[];
  dayOff: TeamMemberToday[];
  other: TeamMemberToday[];
  notPlanned: number;
}

export interface HomeDashboard {
  upcomingAbsence: UpcomingAbsence | null;
  myRequests: MyRequest[];
  pendingApprovals: PendingApproval[];
}

export type ApiRequestKind = 'Vacation' | 'BusinessTrip';

export interface BookingRequestResponse {
  id: number;
  kind: ApiRequestKind;
  vacationType: VacationType | null;
  route: string | null;
  startDate: string;
  endDate: string;
  status: string;
  createdAt: string;
}

export interface MyRequestsResponse {
  upcomingAbsence: BookingRequestResponse | null;
  items: BookingRequestResponse[];
}

export interface PendingApprovalResponse {
  id: number;
  kind: ApiRequestKind;
  vacationType: VacationType | null;
  route: string | null;
  employee: {id: number; fullName: string; positionName?: string | null} | null;
  participantsCount: number;
  startDate: string;
  endDate: string;
  createdAt: string;
}

export interface PendingApprovalsCount {
  vacations: number;
  businessTrips: number;
}
