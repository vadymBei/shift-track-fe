import {inject, Injectable} from "@angular/core";
import {HttpClient, HttpParams} from "@angular/common/http";
import {PayrollRequest} from "../models/payroll-request.model";
import {PayrollSummary} from "../models/payroll-summary.model";
import {MarkPayrollPaidRequest} from "../models/mark-payroll-paid-request.model";

@Injectable({
  providedIn: 'root'
})

export class PayrollsService {
  private httpClient = inject(HttpClient);

  private path = 'organization/payrolls';

  getPayrollsByPeriod(request: PayrollRequest) {
    let filter = new HttpParams();

    if (request !== undefined && request !== null) {
      if (request.period !== undefined && request.period !== null) {
        filter = filter.set('period', request.period.toString());
      }

      if (request.departmentId !== undefined && request.departmentId !== null) {
        filter = filter.set('departmentId', request.departmentId);
      }
    }

    return this.httpClient.get<PayrollSummary>(this.path + '/by-period',
      {
        params: filter
      });
  }

  markPayrollAsPaid(request: MarkPayrollPaidRequest) {
    return this.httpClient.put(this.path + '/mark-as-paid',
      {
        employeeId: request.employeeId,
        period: request.period.toISOString()
      });
  }
}
