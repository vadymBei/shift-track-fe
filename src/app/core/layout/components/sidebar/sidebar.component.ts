import {Component, computed, effect, inject, input, output, untracked} from '@angular/core';
import {RouterLink, RouterLinkActive} from '@angular/router';
import {Button} from 'primeng/button';
import {Ripple} from 'primeng/ripple';
import {Skeleton} from 'primeng/skeleton';
import {Tooltip} from 'primeng/tooltip';
import {AccountService} from '../../../account/services/account.service';
import {NAV_ITEMS} from '../../constants/nav-items';
import {MenuItem} from '../../models/menu-item.model';
import {MANAGER_ROLES} from '../../../account/constants/default-roles-catalog.constants';
import {HomeService} from '../../../../features/home/services/home.service';
import {UserMenuComponent} from '../user-menu/user-menu.component';
import {ThemeToggleComponent} from '../../../../shared/components/theme-toggle/theme-toggle.component';
import {NotificationBellComponent} from '../../../notifications/components/notification-bell/notification-bell.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    Button,
    Ripple,
    Skeleton,
    Tooltip,
    UserMenuComponent,
    ThemeToggleComponent,
    NotificationBellComponent
  ],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  private accountService = inject(AccountService);
  private homeService = inject(HomeService);

  collapsed = input(false);
  collapsible = input(true);

  toggleCollapse = output<void>();
  navigate = output<void>();

  readonly isUserLoaded = computed(() => this.accountService.currentUser() !== null);

  private readonly isManager = computed(() =>
    (this.accountService.currentUser()?.roles ?? []).some(role => MANAGER_ROLES.includes(role)));

  constructor() {
    effect(() => {
      const userId = this.accountService.currentUser()?.employee?.id;
      const manager = this.isManager();
      if (userId && manager) {
        untracked(() => this.homeService.loadPendingCounts(userId));
      }
    });
  }

  badgeCount(item: MenuItem): number {
    return item.badge && this.isManager() ? this.homeService.pendingCounts()[item.badge] : 0;
  }

  readonly menuItems = computed(() => {
    const userRoles = new Set(this.accountService.currentUser()?.roles ?? []);
    return NAV_ITEMS.filter(item => !item.roles?.length || item.roles.some(role => userRoles.has(role)));
  });

  readonly skeletonItems = [1, 2, 3, 4, 5];
}
