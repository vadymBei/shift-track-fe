import {Component, signal} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {PrimeTemplate} from 'primeng/api';
import {Drawer} from 'primeng/drawer';
import {SidebarComponent} from '../sidebar/sidebar.component';
import {HeaderComponent} from '../header/header.component';

const COLLAPSED_KEY = 'st-sidebar-collapsed';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    PrimeTemplate,
    Drawer,
    SidebarComponent,
    HeaderComponent
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.scss'
})
export class LayoutComponent {
  readonly collapsed = signal<boolean>(this.readCollapsed());
  readonly drawerVisible = signal<boolean>(false);

  toggleCollapsed(): void {
    const value = !this.collapsed();
    this.collapsed.set(value);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(value));
    } catch {
    }
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
