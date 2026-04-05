import {Routes} from "@angular/router";
import {UnitsPageComponent} from "../../features/organization/structure/pages/units/units-page/units-page.component";
import {AdministrationPageComponent} from "./pages/administration-page/administration-page.component";
import {
  DepartmentsPageComponent
} from "../../features/organization/structure/pages/departments/departments-page/departments-page.component";
import {
  TimesheetShiftsPageComponent
} from "../../features/organization/timesheet/pages/shifts/timesheet-shifts-page/timesheet-shifts-page.component";
import {
  PositionsPageComponent
} from "../../features/organization/structure/pages/positions/positions-page/positions-page.component";
import {
  EmployeesPageComponent
} from "../../features/organization/employees/pages/employees-page/employees-page.component";
import {EditAccountPageComponent} from "../account/pages/edit-account-page/edit-account-page.component";
import {EmployeesRolesPageComponent} from "../account/pages/employees-roles-page/employees-roles-page.component";
import {ChangePasswordPageComponent} from "../account/pages/change-password-page/change-password-page.component";

const routes: Routes = [
  {
    path: '',
    component: AdministrationPageComponent
  },
  {
    path: 'units',
    component: UnitsPageComponent
  },
  {
    path: 'departments',
    component: DepartmentsPageComponent
  },
  {
    path: 'shifts',
    component: TimesheetShiftsPageComponent
  },
  {
    path: 'profile/edit',
    component: EditAccountPageComponent
  },
  {
    path: 'positions',
    component: PositionsPageComponent
  },
  {
    path: 'employees',
    component: EmployeesPageComponent
  },
  {
    path: 'employees-roles',
    component: EmployeesRolesPageComponent
  },
  {
    path: 'change-password',
    component: ChangePasswordPageComponent
  }
]

export default routes;
