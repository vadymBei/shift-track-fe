import {inject, Injectable} from '@angular/core';
import {AllVacationsRequest} from "../models/all-vacations-request.model";
import {HttpClient, HttpParams} from "@angular/common/http";
import {Vacation} from "../models/vacation.model";
import {CreateVacationRequest} from "../models/create-vacation-request.modal";
import {EditVacationRequest} from "../models/edit-vacation-request.model";
import {map, Observable} from 'rxjs';
import moment from 'moment';
import {VacationBalance} from '../models/vacation-balance.model';

@Injectable({
  providedIn: 'root'
})
export class VacationService {
  private httpClient = inject(HttpClient);

  private path = 'booking/vacations';

  getVacations(request: AllVacationsRequest) {
    let filter = new HttpParams();

    if (request !== undefined && request !== null) {
      if (request.unitId !== undefined && request.unitId !== null) {
        filter = filter.set('unitId', request.unitId);
      }

      if (request.departmentId !== undefined && request.departmentId !== null) {
        filter = filter.set('departmentId', request.departmentId);
      }

      if (request.startDate !== undefined && request.startDate !== null) {
        filter = filter.set('startDate', request.startDate.toString());
      }

      if (request.endDate !== undefined && request.endDate !== null) {
        filter = filter.set('endDate', request.endDate.toString());
      }

      if (request.searchPattern) {
        filter = filter.set('searchPattern', request.searchPattern);
      }

      if (request.vacationStatus !== undefined && request.vacationStatus !== null) {
        filter = filter.set('status', request.vacationStatus.toString());
      }
    }

    return this.httpClient.get<Vacation[]>(`${this.path}`,
      {
        params: filter
      }
    );
  }

  deleteVacation(vacationId: number) {
    return this.httpClient.delete(`${this.path}/${vacationId}`);
  }

  createVacation(request: CreateVacationRequest) {
    return this.httpClient.post<Vacation>(`${this.path}`, request);
  }

  getVacationById(vacationId: number) {
    return this.httpClient.get<Vacation>(`${this.path}/${vacationId}`);
  }

  getVacationBalanceByEmployeeId(employeeId: number) {
    return this.httpClient.get<VacationBalance>(`${this.path}/balance/by-employeeId/${employeeId}`);
  }

  updateVacation(request: EditVacationRequest) {
    return this.httpClient.put<Vacation>(`${this.path}`, request);
  }

  approveVacation(vacationId: number) {
    return this.httpClient.put<Vacation>(`${this.path}/approve/${vacationId}`, {});
  }

  rejectVacation(vacationId: number) {
    return this.httpClient.put<Vacation>(`${this.path}/reject/${vacationId}`, {});
  }

  downloadVacationRequest(vacationId: number) {
    return this.httpClient.get(`${this.path}/download/request/pdf/${vacationId}`,
      {
        responseType: 'blob'
      });
  }

  saveVacationRequestPdf(vacation: Vacation): Observable<void> {
    return this.downloadVacationRequest(vacation.id).pipe(
      map(blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Відпустка працівника ${vacation.employee.fullName} `
          + `${moment(vacation.startDate).format('DD.MM.YYYY')}-${moment(vacation.endDate).format('DD.MM.YYYY')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      })
    );
  }
}
