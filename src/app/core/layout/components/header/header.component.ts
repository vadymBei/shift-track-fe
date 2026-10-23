import {Component, output} from '@angular/core';
import {Button} from 'primeng/button';
import {UserMenuComponent} from '../user-menu/user-menu.component';
import {ThemeToggleComponent} from '../../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [Button, UserMenuComponent, ThemeToggleComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  menuClick = output<void>();
}
