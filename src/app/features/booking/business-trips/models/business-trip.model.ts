import {BusinessTripStatus} from "../enums/business-trip-status.enum";
import {Employee} from "../../../organization/employees/models/employee.model";
import {BusinessTripLocation} from "./business-trip-location.model";

export interface BusinessTrip {
  id: number;
  startDate: Date;
  endDate: Date;
  description: string;
  estimatedBudget: number;
  status: BusinessTripStatus;
  authorId: number | null;
  participants: Employee[];
  locations: BusinessTripLocation[];
  permissions?: BusinessTripPermissions;
}

export interface BusinessTripPermissions {
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  canReject: boolean;
  canDelete: boolean;
  canDownload: boolean;
}

export const NO_BUSINESS_TRIP_PERMISSIONS: BusinessTripPermissions = {
  canView: false,
  canEdit: false,
  canApprove: false,
  canReject: false,
  canDelete: false,
  canDownload: false
};

export function businessTripPermissions(trip: BusinessTrip): BusinessTripPermissions {
  return trip.permissions ?? NO_BUSINESS_TRIP_PERMISSIONS;
}
