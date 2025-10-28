import {inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {CreateEmployeeShiftRequest} from "../models/create-employee-shift-request.model";

@Injectable({
  providedIn: 'root'
})
export class EmployeeShiftService {
  private httpClient = inject(HttpClient);

  private path = 'timesheet/employee-shifts';

  createEmployeeShifts(request: CreateEmployeeShiftRequest[]) {
    return this.httpClient.post(this.path + `/list`, request);
  }
}
