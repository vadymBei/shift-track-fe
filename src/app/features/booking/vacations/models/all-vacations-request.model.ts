import {VacationStatus} from "../enums/vacation-status.enum";

export interface AllVacationsRequest {
  startDate?: Date;
  endDate?: Date;
  unitId?: number;
  departmentId?: number;
  searchPattern?: string;
  vacationStatus?: VacationStatus;
}
