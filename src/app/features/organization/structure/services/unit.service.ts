import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Unit } from '../models/unit.model';
import { EditUnitRequest } from '../models/edit-unit-request.model';
import { CreateUnitRequest } from '../models/create-unit-request.model';

@Injectable({
  providedIn: 'root'
})
export class UnitService {
  private httpClient = inject(HttpClient);

  private path = 'organization/structure/units';

  constructor() { }

  getUnits() {
    return this.httpClient.get<Unit[]>(this.path);
  }

  getUnitsByRoles() {
    return this.httpClient.get<Unit[]>(this.path + '/by-roles');
  }

  updateUnit(request: EditUnitRequest) {
    return this.httpClient.put<Unit>(this.path, request);
  }

  getUnitById(id: number) {
    return this.httpClient.get<Unit>(this.path + `/${id}`);
  }

  deleteUnitById(id: number) {
    return this.httpClient.delete(this.path + `/${id}`);
  }

  createUnit(request: CreateUnitRequest) {
    return this.httpClient.post<Unit>(this.path, request);
  }
}
