import {inject, Injectable} from "@angular/core";
import {HttpClient, HttpContext, HttpHeaders} from "@angular/common/http";
import {Location} from "../models/location.model";
import {BYPASS_TOKEN} from "../../../../shared/interceptors/tocken.interceptor";
import {BYPASS_API} from "../../../../shared/interceptors/api.interceptor";
import {API_HOST} from "../../../../shared/constants/api.constants";

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private httpClient = inject(HttpClient);

  private path = `${API_HOST}/api/locations`;

  private readonly basicAuth = 'Basic ' + btoa('location-user:64gsSv0}!r,S');

  searchLocations(searchPattern: string) {
    return this.httpClient.post<Location[]>(`${this.path}/search`,
      { searchTerm: searchPattern },
      {
        headers: new HttpHeaders({Authorization: this.basicAuth}),
        context: new HttpContext().set(BYPASS_TOKEN, true).set(BYPASS_API, true)
      });
  }
}
