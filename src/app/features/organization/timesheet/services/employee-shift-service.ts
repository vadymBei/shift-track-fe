import {inject, Injectable} from "@angular/core";
import {HttpClient, HttpParams} from "@angular/common/http";
import {CreateEmployeeShiftRequest} from "../models/create-employee-shift-request.model";
import {EmployeeShift} from "../models/employee-shift.model";

@Injectable({
  providedIn: 'root'
})
export class EmployeeShiftService {
  private httpClient = inject(HttpClient);

  private path = 'timesheet/employee-shifts';

  getByEmployeeId(employeeId: number, dateFrom: string, dateTo: string) {
    const params = new HttpParams()
      .set('EmployeeId', employeeId)
      .set('DateFrom', dateFrom)
      .set('DateTo', dateTo);
    return this.httpClient.get<EmployeeShift[]>(this.path + '/by-employee-id', {params});
  }

  createEmployeeShifts(request: CreateEmployeeShiftRequest[]) {
    return this.httpClient.post(this.path + `/list`, request);
  }
}
