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
  participants: Employee[];
  locations: BusinessTripLocation[];
}
