import {Routes} from '@angular/router';
import {authGuard} from './core/account/guards/auth.guard';

const loadLayout = () => import('./core/layout/components/layout/layout.component')
  .then(m => m.LayoutComponent);

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./core/account/pages/login-page/login-page.component')
      .then(m => m.LoginPageComponent)
  },
  {
    path: 'home',
    loadComponent: loadLayout,
    loadChildren: () => import("./features/home/home.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'employees',
    loadComponent: loadLayout,
    loadChildren: () => import("./features/organization/employees/employees.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'business-trips',
    loadComponent: loadLayout,
    loadChildren: () => import("./features/booking/business-trips/business-trips.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'account',
    loadChildren: () => import("./core/account/account.routes")
  },
  {
    path: 'timesheet',
    loadComponent: loadLayout,
    loadChildren: () => import("./features/organization/timesheet/timesheet.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'administration',
    loadComponent: loadLayout,
    loadChildren: () => import("./core/administration/administration.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'vacations',
    loadComponent: loadLayout,
    loadChildren: () => import("./features/booking/vacations/vacations.routes"),
    canActivate: [authGuard]
  },
  {
    path: 'payrolls',
    loadComponent: loadLayout,
    loadChildren: () => import("./features/organization/payrolls/payrolls.routes"),
    canActivate: [authGuard]
  },
];
