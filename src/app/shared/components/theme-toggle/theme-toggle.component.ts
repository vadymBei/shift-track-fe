import {Component, computed, inject} from '@angular/core';
import {Button} from 'primeng/button';
import {Tooltip} from 'primeng/tooltip';
import {ThemeService} from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [Button, Tooltip],
  template: `
    <p-button
      [icon]="theme.isDark() ? 'pi pi-sun' : 'pi pi-moon'"
      [rounded]="true"
      [text]="true"
      severity="secondary"
      [ariaLabel]="label()"
      [pTooltip]="label()"
      tooltipPosition="bottom"
      (onClick)="theme.toggle()"/>
  `
})
export class ThemeToggleComponent {
  theme = inject(ThemeService);

  label = computed(() => this.theme.isDark() ? 'Світла тема' : 'Темна тема');
}
