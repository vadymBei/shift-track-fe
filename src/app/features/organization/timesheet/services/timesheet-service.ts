import {inject, Injectable} from "@angular/core";
import {HttpClient, HttpParams} from "@angular/common/http";
import {Timesheet} from "../models/timesheet-model";
import {TimesheetRequest} from "../models/timesheet-request.model";
import {ExportTimesheetRequest} from "../models/export-timesheet-request.model";

@Injectable({
  providedIn: 'root'
})
export class TimesheetService {
  private httpClient = inject(HttpClient);

  private path = 'timesheet';

  getTimesheet(request: TimesheetRequest) {
    let filter = new HttpParams();

    if (request !== undefined && request !== null) {
      if (request.period !== undefined && request.period !== null) {
        filter = filter.set('period', request.period.toString());
      }

      if (request.departmentId !== undefined && request.departmentId !== null) {
        filter = filter.set('departmentId', request.departmentId);
      }
    }

    return this.httpClient.get<Timesheet>(this.path,
      {
        params: filter
      });
  }

  exportTimesheet(request: ExportTimesheetRequest) {
    let filter = new HttpParams();

    if (request !== undefined && request !== null) {
      if (request.period !== undefined && request.period !== null) {
        filter = filter.set('period', request.period.toString());
      }

      if (request.departmentId !== undefined && request.departmentId !== null) {
        filter = filter.set('departmentId', request.departmentId);
      }

      filter = filter.set('exportWorkHours', request.exportWorkHours);
    }

    return this.httpClient.get(this.path + '/export',
      {
        params: filter,
        responseType: 'blob'
      });
  }
}
