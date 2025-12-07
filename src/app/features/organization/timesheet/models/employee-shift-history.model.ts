import {EmployeeShift} from "./employee-shift.model";
import {Shift} from "./shift.model";
import {Employee} from "../../employees/models/employee.model";

export interface EmployeeShiftHistory {
  id: number;
  previousStartTime?: string | null;
  previousEndTime?: string | null;
  newStartTime?: string | null;
  newEndTime?: string | null;
  createdAt: Date;
  employeeShiftId: number;
  employeeShift: EmployeeShift;

  previousShiftId?: number | null;
  previousShift?: Shift | null;

  newShiftId?: number | null;
  newShift?: Shift | null;

  author: Employee;
}
