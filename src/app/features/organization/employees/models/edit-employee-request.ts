import { EmployeeGender } from "../enums/employee-gender.enum";

export interface EditEmployeeRequest {
    id: number;
    name: string;
    surname: string;
    patronymic: string;
    email: string;
    departmentId?: number;
    positionId?: number;
    dateOfBirth?: Date;
    /** 2026-10-27; null clears it (the registration date counts then). */
    hireDate: string | null;
    gender: EmployeeGender;
}
