import {Component, input} from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    @if (icon()) {
      <i [class]="icon()" aria-hidden="true"></i>
    }
    <span class="empty-title">{{ heading() }}</span>
    @if (hint()) {
      <span class="empty-text">{{ hint() }}</span>
    }
    <ng-content/>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 48px 16px;
      text-align: center;
    }

    :host(.tall) {
      padding: 96px 16px;
    }

    i {
      margin-bottom: 4px;
      font-size: 28px;
      color: var(--p-text-muted-color);
    }

    .empty-title {
      font-weight: 600;
    }

    .empty-text {
      font-size: 14px;
      color: var(--p-text-muted-color);
    }

    :host(.narrow) .empty-text {
      max-width: 360px;
    }

    :host ::ng-deep > p-button {
      margin-top: 10px;
    }
  `
})
export class EmptyStateComponent {
  readonly icon = input<string>('');
  readonly heading = input.required<string>();
  readonly hint = input<string>('');
}
