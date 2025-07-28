import {VacationType} from "../enums/vacation-type.enum";

export interface CreateVacationRequest {
  startDate: Date;
  endDate: Date;
  comment: string;
  employeeId: number;
  type: VacationType;
}
