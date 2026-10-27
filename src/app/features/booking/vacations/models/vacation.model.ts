import {VacationType} from "../enums/vacation-type.enum";
import {VacationStatus} from "../enums/vacation-status.enum";
import {Employee} from "../../../organization/employees/models/employee.model";

export interface Vacation {
  id: number;
  startDate: Date;
  endDate: Date;
  daysCount: number;
  type: VacationType
  status: VacationStatus
  employee: Employee;
  authorId: number | null;
  createdAt: Date;
  comment: string;
  permissions?: VacationPermissions;
}

export interface VacationPermissions {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canDelete: boolean;
  canDownload: boolean;
  approveSubmitsForApproval: boolean;
}

export const NO_VACATION_PERMISSIONS: VacationPermissions = {
  canView: false,
  canEdit: false,
  canApprove: false,
  canReject: false,
  canDelete: false,
  canDownload: false,
  approveSubmitsForApproval: false
};

export function vacationPermissions(vacation: Vacation): VacationPermissions {
  return vacation.permissions ?? NO_VACATION_PERMISSIONS;
}

export function isVacationDecision(permissions: VacationPermissions): boolean {
  return permissions.canReject || (permissions.canApprove && !permissions.approveSubmitsForApproval);
}
