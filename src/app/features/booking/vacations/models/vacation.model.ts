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
  createdAt: Date;
  comment: string;
}
