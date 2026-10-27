import {inject, Injectable} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {Location} from "../models/location.model";

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private httpClient = inject(HttpClient);

  private path = 'booking/business-trips/locations';

  searchLocations(searchPattern: string) {
    return this.httpClient.get<Location[]>(`${this.path}/search`, {
      params: {searchTerm: searchPattern}
    });
  }
}
