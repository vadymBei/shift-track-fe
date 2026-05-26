import {Routes} from '@angular/router';
import {LayoutComponent} from './core/layout/components/layout/layout.component';
import {authGuard} from './core/account/guards/auth.guard';
import {LoginPageComponent} from './core/account/pages/login-page/login-page.component';

export const routes: Routes = [
  {
    path: '',
    component: LoginPageComponent
  },
  {
    path: 'employees',
    component: LayoutComponent,
    loadChildren: () => import("./features/organization/employees/employees.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'business-trips',
    component: LayoutComponent,
    loadChildren: () => import("./features/booking/business-trips/business-trips.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'account',
    loadChildren: () => import("./core/account/account.routes")
  },
  {
    path: 'timesheet',
    component: LayoutComponent,
    loadChildren: () => import("./features/organization/timesheet/timesheet.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'administration',
    component: LayoutComponent,
    loadChildren: () => import("./core/administration/administration.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'vacations',
    component: LayoutComponent,
    loadChildren: () => import("./features/booking/vacations/vacations.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'salary',
    component: LayoutComponent,
    loadChildren: () => import("./features/organization/salary/salary.routes"),
    canActivate: [authGuard]
  },
];
