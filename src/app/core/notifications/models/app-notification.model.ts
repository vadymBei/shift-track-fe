export type NotificationModuleType = 'System' | 'Vacation' | 'BusinessTrip' | 'Timesheet' | 'Payroll' | 'Messenger';

export type NotificationType =
  | 'None'
  | 'VacationPendingApproval'
  | 'VacationApproved'
  | 'VacationFinallyApproved'
  | 'VacationRejected'
  | 'VacationCreatedForYou'
  | 'VacationDeleted'
  | 'BusinessTripPendingApproval'
  | 'BusinessTripAdded'
  | 'BusinessTripApproved'
  | 'BusinessTripRejected'
  | 'BusinessTripChanged'
  | 'BusinessTripRemoved'
  | 'ShiftChanged'
  | 'ScheduleUpdated'
  | 'PayrollPaid'
  | 'RoleChanged'
  | 'EmployeeRegistered'
  | 'Mention';

export interface AppNotification {
  id: number;
  type: NotificationType;
  moduleType: NotificationModuleType;
  entityId: number | null;
  title: string;
  message: string | null;
  createdAt: string;
  readAt: string | null;
  authorId: number | null;
  authorFullName: string | null;
}
