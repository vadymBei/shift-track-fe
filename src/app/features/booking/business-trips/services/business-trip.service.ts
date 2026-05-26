import {inject, Injectable} from "@angular/core";
import {HttpClient, HttpParams} from "@angular/common/http";
import {FilteredBusinessTripsRequest} from "../models/filtered-business-trips-request.model";
import {BusinessTrip} from "../models/business-trip.model";
import {CreateBusinessTripRequest} from "../models/create-business-trip-request.model";

@Injectable({
  providedIn: 'root'
})
export class BusinessTripService {
  private httpClient = inject(HttpClient);

  private path = 'booking/business-trips';

  create(request: CreateBusinessTripRequest){
    return this.httpClient.post(`${this.path}`, request);
  }

  getFiltered(request: FilteredBusinessTripsRequest) {
    let filter = new HttpParams();
    filter = filter.set('startDate', request.startDate.toString());
    filter = filter.set('endDate', request.endDate.toString());
    filter = filter.set('departmentId', request.departmentId);

    if (request.searchPattern) {
      filter = filter.set('searchPattern', request.searchPattern);
    }

    return this.httpClient.get<BusinessTrip[]>(`${this.path}/filtered`, {params: filter});
  }

  update(request: {
    id: number;
    startDate: Date;
    endDate: Date;
    description: string;
    estimatedBudget: number;
    employeeIds: number[];
    locationIntegrationIds: string[];
  }) {
    return this.httpClient.put(`${this.path}`, request);
  }

  delete(id: number) {
    return this.httpClient.delete(`${this.path}/${id}`);
  }
}
