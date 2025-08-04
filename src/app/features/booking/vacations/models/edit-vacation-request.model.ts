import {VacationType} from "../enums/vacation-type.enum";

export interface EditVacationRequest {
  id: number;
  startDate: Date;
  endDate: Date;
  comment: string;
  type: VacationType;
}
