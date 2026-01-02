import {HttpClient, HttpParams} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {Employee} from '../models/employee.model';
import {AllEmployeesRequest} from '../models/all-employees-request.model';
import {EditEmployeeRequest} from '../models/edit-employee-request';

@Injectable({
  providedIn: 'root'
})
export class EmployeesService {
  private httpClient = inject(HttpClient);

  private path = 'organization/employees';

  getAllEmployees(request: AllEmployeesRequest) {
    let filter = new HttpParams();

    if (request !== undefined && request !== null) {
      if (request.departmentId !== undefined && request.departmentId !== null) {
        filter = filter.set('departmentId', request.departmentId);
      }

      if (request.unitId !== undefined && request.unitId !== null) {
        filter = filter.set('unitId', request.unitId);
      }

      if (request.searchPattern) {
        filter = filter.set('searchPattern', request.searchPattern);
      }
    }

    return this.httpClient.get<Employee[]>(`${this.path}`,
      {
        params: filter
      }
    );
  }

  getEmployeeById(id: number) {
    return this.httpClient.get<Employee>(this.path + `/${id}`);
  }

  updateEmployee(request: EditEmployeeRequest) {
    return this.httpClient.put<Employee>(
      this.path,
      request);
  }
}
