import {Component, OnInit} from '@angular/core';
import {AccountService} from '../../../account/services/account.service';
import {RouterLink} from '@angular/router';
import {CurrentUser} from "../../../account/models/current-user.model";
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
  constructor(private accountService: AccountService) {
  }

  logOut(): void {
    this.accountService.logout();
  }
}
