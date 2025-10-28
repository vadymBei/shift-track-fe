import {Shift} from "./shift.model";

export interface EmployeeShift {
  id: number;
  date: Date;
  employeeId: number;
  endTime: Date;
  startTime: Date;
  shiftId: number;
  shift: Shift;
}
