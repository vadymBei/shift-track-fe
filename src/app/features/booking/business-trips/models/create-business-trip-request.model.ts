export interface CreateBusinessTripRequest {
  startDate: Date;
  endDate: Date;
  description: string;
  estimatedBudget: number;
  employeeIds: number[];
  locationIntegrationIds: string[];
}
