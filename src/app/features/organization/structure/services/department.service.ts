import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Department } from '../models/department.model';
import { CreateDepartmentRequest } from '../models/create-demartment-request.model';
import { EditDepartmentRequest } from '../models/edit-department-request.model';
import { GroupedDepartmentsByUnit } from '../models/grouped-departments-by-unit.model';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private httpClient = inject(HttpClient);

  private path = 'organization/structure/departments';

  constructor() { }

  getGroupedDepartmentsGroupedByUnits() {
    return this.httpClient.get<GroupedDepartmentsByUnit[]>(this.path + `/grouped/by-unit`);
  }

  getDepartmentById(id: number) {
    return this.httpClient.get<Department>(this.path + `/by-id/${id}`);
  }

  getDepartmentsByUnitId(unitId: number) {
    return this.httpClient.get<Department[]>(this.path + `/by-unitId/${unitId}`);
  }

  getDepartmentsByRoles(unitId: number) {
    return this.httpClient.get<Department[]>(this.path + `/by-roles/${unitId}`);
  }

  createDepartment(request: CreateDepartmentRequest) {
    return this.httpClient.post<Department>(this.path, request);
  }

  updateDepartment(request: EditDepartmentRequest) {
    return this.httpClient.put<Department>(this.path, request);
  }

  deleteDepartment(departmentId: number) {
    return this.httpClient.delete(this.path + `/${departmentId}`);
  }
}
