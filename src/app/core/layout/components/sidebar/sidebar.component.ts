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
  private accountService = inject(AccountService);

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
      link: '/trips'
    },
    {
      label: 'Довідник',
      icon: 'bi bi-journal-text',
      link: '/employees/contact-list'
    },
    {
      label: 'Адміністрування',
      icon: 'bi bi-person-gear',
      link: '/administration',
      roles: [DefaultRolesCatalog.SYS_ADMIN, DefaultRolesCatalog.UNIT_DIRECTOR]
    }
  ];


  public menuItems = computed(() => {
    const userRoles = this.accountService.currentUser()?.roles || [];

    return this.allMenuItems
      .filter(item => {
        if (!item.roles || item.roles.length === 0)
          return true;

        return item.roles.some(role => userRoles.includes(role));
      });
  });
}
