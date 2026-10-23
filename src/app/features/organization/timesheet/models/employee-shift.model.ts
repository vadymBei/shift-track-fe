import {Shift} from "./shift.model";

export interface EmployeeShift {
  id: number;
  date: Date;
  employeeId: number;
  startTime?: string | null;
  endTime?: string | null;
  shiftId: number;
  shift: Shift;
}
