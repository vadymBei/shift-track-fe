import {EmployeeTimesheet} from "./employee-timesheet.model";

export interface Timesheet {
  startDate: Date;
  endDate: Date;
  employeeTimesheets: EmployeeTimesheet[];
}
