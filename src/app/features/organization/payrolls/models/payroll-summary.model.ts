import {Payroll} from "./payroll.model";

export interface PayrollSummary {
  totalAmount: number;
  totalEmployees: number;
  totalWorkedHours: number;
  payrolls: Payroll[];
}
