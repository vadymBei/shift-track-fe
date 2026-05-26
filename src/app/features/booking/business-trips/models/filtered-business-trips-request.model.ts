export interface FilteredBusinessTripsRequest {
  startDate: Date;
  endDate: Date;
  departmentId: number;
  searchPattern: string;
}
