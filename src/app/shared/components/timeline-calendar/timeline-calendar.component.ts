import {Component, computed, input, output} from '@angular/core';
import {DatePipe} from '@angular/common';
import {addDays, addMonths, endOfMonth, getDaysInMonth, isAfter, isBefore, isSameDay, max, min, startOfDay, startOfMonth} from 'date-fns';
import {toDate} from '../../utils/date.utils';
import {Button} from 'primeng/button';
import {Tooltip} from 'primeng/tooltip';
import {Avatar} from 'primeng/avatar';

export type TimelineSeverity = 'warn' | 'info' | 'success' | 'danger' | 'secondary';

export interface TimelineItem<T = unknown> {
  id: string | number;
  rowKey: string | number;
  rowLabel: string;
  rowInitials: string;
  start: Date | string;
  end: Date | string;
  label: string;
  tooltip: string;
  severity: TimelineSeverity;
  countInTotals: boolean;
  data: T;
}

export interface TimelineLegendItem {
  label: string;
  severity: TimelineSeverity;
}

interface Day {
  day: number;
  weekday: string;
  weekend: boolean;
  today: boolean;
  column: number;
}

interface Bar<T> {
  item: TimelineItem<T>;
  gridColumn: string;
  label: string;
}

interface Row<T> {
  key: string | number;
  label: string;
  initials: string;
  bars: Bar<T>[];
}

const WEEKDAYS = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

@Component({
  selector: 'app-timeline-calendar',
  standalone: true,
  imports: [DatePipe, Button, Tooltip, Avatar],
  templateUrl: './timeline-calendar.component.html',
  styleUrl: './timeline-calendar.component.scss'
})
export class TimelineCalendarComponent<T = unknown> {
  items = input<TimelineItem<T>[]>([]);
  month = input<Date>(new Date());
  legend = input<TimelineLegendItem[]>([]);
  rowsTitle = input('Працівник');
  totalsTitle = input('Відсутні, осіб');
  emptyText = input('У цьому місяці записів немає');

  monthChange = output<Date>();
  itemClick = output<T>();

  private readonly monthStart = computed(() => startOfMonth(toDate(this.month())));
  private readonly daysInMonth = computed(() => getDaysInMonth(this.monthStart()));

  readonly monthDate = computed(() => this.monthStart());
  readonly gridTemplate = computed(() => `200px repeat(${this.daysInMonth()}, minmax(24px, 1fr))`);

  readonly days = computed<Day[]>(() => {
    const start = this.monthStart();
    const today = new Date();
    return Array.from({length: this.daysInMonth()}, (_, i) => {
      const date = addDays(start, i);
      const dow = date.getDay();
      return {
        day: i + 1,
        weekday: WEEKDAYS[dow],
        weekend: dow === 0 || dow === 6,
        today: isSameDay(date, today),
        column: i + 2
      };
    });
  });

  readonly rows = computed<Row<T>[]>(() => {
    const monthStart = this.monthStart();
    const monthEnd = startOfDay(endOfMonth(monthStart));
    const rows = new Map<string | number, Row<T>>();

    for (const item of this.items()) {
      const start = startOfDay(toDate(item.start));
      const end = startOfDay(toDate(item.end));
      if (isBefore(end, monthStart) || isAfter(start, monthEnd)) {
        continue;
      }

      let row = rows.get(item.rowKey);
      if (!row) {
        row = {key: item.rowKey, label: item.rowLabel, initials: item.rowInitials, bars: []};
        rows.set(item.rowKey, row);
      }

      const from = max([start, monthStart]);
      const to = min([end, monthEnd]);
      row.bars.push({
        item,
        gridColumn: `${from.getDate() + 1} / ${to.getDate() + 2}`,
        label: `${isBefore(start, monthStart) ? '← ' : ''}${item.label}${isAfter(end, monthEnd) ? ' →' : ''}`
      });
    }

    return [...rows.values()].sort((a, b) => a.label.localeCompare(b.label, 'uk'));
  });

  readonly totals = computed(() => {
    const monthStart = this.monthStart();
    const perDay: Set<string | number>[] = Array.from({length: this.daysInMonth()}, () => new Set());

    for (const item of this.items()) {
      if (!item.countInTotals) continue;
      const start = startOfDay(toDate(item.start));
      const end = startOfDay(toDate(item.end));
      perDay.forEach((set, i) => {
        const day = addDays(monthStart, i);
        if (!isBefore(day, start) && !isAfter(day, end)) set.add(item.rowKey);
      });
    }

    return perDay.map((set, i) => ({count: set.size, column: i + 2}));
  });

  shiftMonth(delta: number): void {
    this.monthChange.emit(addMonths(this.monthStart(), delta));
  }
}
