import {inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {EmployeeShiftHistory} from "../models/employee-shift-history.model";

@Injectable({
  providedIn: 'root'
})
export class EmployeeShiftHistoryService{
  private httpClient = inject(HttpClient);

  private path = 'timesheet/employee-shift-history';

  getEmployeeShiftHistoryByEmployeeShiftId(employeeShiftId: number) {
    return this.httpClient.get<EmployeeShiftHistory[]>(this.path+ `/by-employeeShiftId/${employeeShiftId}`);
  }
}
