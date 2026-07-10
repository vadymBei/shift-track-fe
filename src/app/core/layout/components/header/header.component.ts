import {Component, inject} from '@angular/core';
import {AccountService} from '../../../account/services/account.service';
import {RouterLink} from '@angular/router';
import {CommonModule} from "@angular/common";

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  isDropdownMenuOpened = false;

  accountService = inject(AccountService);

  logOut(): void {
    this.accountService.logout();
  }
}
