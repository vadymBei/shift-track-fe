import { EmployeeGender } from "../enums/employee-gender.enum";
import { Department } from "../../structure/models/department.model";
import { Position } from "../../structure/models/position.model";

export interface Employee {
    id: number;
    name: string;
    surname: string;
    patronymic: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth?: Date;
    /** First day of work; not set for those registered before it was stored. */
    hireDate?: string | null;
    /** What the vacations are counted from: the hire date or, without it, the registration date. */
    serviceStart?: string;
    /** Registration in the system (UTC). */
    createdAt?: string;
    departmentId?: number;
    department?: Department;
    positionId?: number;
    position?: Position;
    gender: EmployeeGender;
}
