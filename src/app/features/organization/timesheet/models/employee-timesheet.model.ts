import {EmployeeShift} from "./employee-shift.model";
import {Employee} from "../../employees/models/employee.model";

export interface EmployeeTimesheet {
  employee: Employee;
  employeeShifts: (EmployeeShift | null)[];
  totalWorkDays: number;
  totalWorkHours: number;
}
