import {Component, computed, inject} from '@angular/core';
import {MenuItem} from '../../models/menu-item.model';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {NgClass} from "@angular/common";
import {AccountService} from "../../../account/services/account.service";
import {DefaultRolesCatalog} from "../../../account/constants/default-roles-catalog.constants";

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    NgClass
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  accountService = inject(AccountService);

  private allMenuItems: MenuItem[] = [
    {
      label: 'Табель',
      icon: 'bi bi-calendar',
      link: '/timesheet'
    },
    {
      label: 'Відпустки',
      icon: 'bi bi-airplane',
      link: '/vacations'
    },
    {
      label: 'Відрядження',
      icon: 'bi bi-briefcase',
      link: '/business-trips'
    },
    {
      label: 'Довідник',
      icon: 'bi bi-journal-text',
      link: '/employees/contact-list'
    },
    {
      label: 'Зарплати',
      icon: 'bi bi-cash-coin',
      link: '/salary'
    },
    {
      label: 'Адміністрування',
      icon: 'bi bi-person-gear',
      link: '/administration',
      roles: [DefaultRolesCatalog.SYS_ADMIN, DefaultRolesCatalog.UNIT_DIRECTOR]
    }
  ];

  readonly isUserLoaded = computed(() => this.accountService.currentUser() !== null);

  readonly menuItems = computed(() => {
    const userRoles = new Set(this.accountService.currentUser()?.roles ?? []);

    return this.allMenuItems.filter(item => {
      if (!item.roles?.length) return true;
      return item.roles.some(role => userRoles.has(role));
    });
  });
}
