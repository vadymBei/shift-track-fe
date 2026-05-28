import {Employee} from "../../employees/models/employee.model";
import {PayrollStatus} from "../enums/payroll-status.enum";

export interface Payroll {
  year: number;
  month: number;
  workedHours: number;
  hourlyRate: number;
  totalAmount: number;
  employeeId: number;
  employee: Employee;
  status: PayrollStatus
  paidAt: Date | null;
}
