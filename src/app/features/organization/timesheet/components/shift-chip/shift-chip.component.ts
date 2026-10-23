import {Component, computed, input} from '@angular/core';
import {Shift} from '../../models/shift.model';
import {readableTextColor} from '../../constants/shift-labels';

export type ShiftChipSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-shift-chip',
  standalone: true,
  template: `{{ shift()?.code ?? placeholder() }}`,
  host: {
    '[class]': '"size-" + size()',
    '[class.empty]': '!shift()',
    '[style.background]': 'shift()?.color || null',
    '[style.color]': 'textColor()',
    '[attr.title]': 'tooltip() || null'
  },
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
      box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.07);
    }

    :host(.size-xs) { min-width: 30px; height: 22px; padding: 0 3px; border-radius: 6px; font-size: 10px; }
    :host(.size-sm) { min-width: 36px; height: 24px; padding: 0 6px; border-radius: 7px; font-size: 11px; }
    :host(.size-md) { min-width: 44px; height: 28px; padding: 0 8px; border-radius: 8px; font-size: 12px; }
    :host(.size-lg) { min-width: 44px; height: 32px; padding: 0 8px; border-radius: 8px; font-size: 12px; }

    :host(.size-xl) {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      font-size: 22px;
      font-weight: 800;
      box-shadow: 0 8px 24px rgba(20, 10, 50, 0.15), inset 0 0 0 1px rgba(0, 0, 0, 0.06);
    }

    :host(.empty) {
      background: transparent;
      box-shadow: none;
      border: 1px dashed var(--p-content-border-color);
      color: var(--p-text-muted-color);
    }

    :host(.size-xl.empty) {
      border-width: 2px;
    }
  `
})
export class ShiftChipComponent {
  readonly shift = input<Pick<Shift, 'code' | 'color'> | null | undefined>(null);
  readonly size = input<ShiftChipSize>('md');
  readonly placeholder = input('—');
  readonly tooltip = input<string | null | undefined>(null);

  readonly textColor = computed(() => {
    const color = this.shift()?.color;
    return color ? readableTextColor(color) : null;
  });
}
