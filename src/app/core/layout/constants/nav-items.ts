import {MenuItem} from '../models/menu-item.model';
import {DefaultRolesCatalog} from '../../account/constants/default-roles-catalog.constants';

export const NAV_ITEMS: MenuItem[] = [
  {label: 'Головна', icon: 'pi pi-home', link: '/home'},
  {label: 'Табель', icon: 'pi pi-calendar', link: '/timesheet'},
  {label: 'Відпустки', icon: 'pi pi-sun', link: '/vacations', badge: 'vacations'},
  {label: 'Відрядження', icon: 'pi pi-briefcase', link: '/business-trips', badge: 'businessTrips'},
  {label: 'Довідник', icon: 'pi pi-book', link: '/employees/contact-list'},
  {label: 'Зарплати', icon: 'pi pi-wallet', link: '/payrolls'},
  {
    label: 'Адміністрування',
    icon: 'pi pi-cog',
    link: '/administration',
    roles: [DefaultRolesCatalog.SYS_ADMIN, DefaultRolesCatalog.UNIT_DIRECTOR]
  }
];
