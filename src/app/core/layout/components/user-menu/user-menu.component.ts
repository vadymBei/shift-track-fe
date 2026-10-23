import {Component, computed, inject, input} from '@angular/core';
import {MenuItem} from 'primeng/api';
import {Menu} from 'primeng/menu';
import {Avatar} from 'primeng/avatar';
import {Ripple} from 'primeng/ripple';
import {AccountService} from '../../../account/services/account.service';
import {CurrentUserPhotoService} from '../../../account/services/current-user-photo.service';
import {personInitials} from '../../../../shared/utils/text.utils';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [Menu, Avatar, Ripple],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss'
})
export class UserMenuComponent {
  private accountService = inject(AccountService);
  readonly photoUrl = inject(CurrentUserPhotoService).photoUrl;

  compact = input(false);

  readonly employee = computed(() => this.accountService.currentUser()?.employee);

  readonly initials = computed(() => personInitials(this.employee(), 'name-first') || '?');

  readonly items: MenuItem[] = [
    {label: 'Редагувати профіль', icon: 'pi pi-user-edit', routerLink: '/administration/profile/edit'},
    {label: 'Змінити пароль', icon: 'pi pi-lock', routerLink: '/administration/change-password'},
    {separator: true},
    {label: 'Вихід', icon: 'pi pi-sign-out', command: () => this.accountService.logout()}
  ];
}
