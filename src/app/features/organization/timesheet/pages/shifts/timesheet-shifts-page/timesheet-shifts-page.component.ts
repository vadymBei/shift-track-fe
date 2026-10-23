import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {finalize, Subject, takeUntil} from 'rxjs';
import {PrimeTemplate} from 'primeng/api';
import {TableModule} from 'primeng/table';
import {Button} from 'primeng/button';
import {Tag} from 'primeng/tag';
import {Tooltip} from 'primeng/tooltip';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {DialogService} from 'primeng/dynamicdialog';
import {ConfirmService} from '../../../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../../../shared/services/notification.service';
import {ShiftsService} from '../../../services/shifts.service';
import {Shift} from '../../../models/shift.model';
import {ShiftType} from '../../../enums/shift-type.enum';
import {ShiftDialogComponent, ShiftDialogData} from '../../../components/shift-dialog/shift-dialog.component';
import {
  formatDuration,
  isOvernight,
  SHIFT_TYPE_META,
  shiftMinutes,
  shortTime
} from '../../../constants/shift-labels';
import {ShiftChipComponent} from '../../../components/shift-chip/shift-chip.component';

interface ShiftGroup {
  key: string;
  title: string;
  hint: string;
  shifts: Shift[];
}

@Component({
  selector: 'app-timesheet-shifts-page',
  standalone: true,
  imports: [ShiftChipComponent, RouterLink, PrimeTemplate, TableModule, Button, Tag, Tooltip, IconField, InputIcon, InputText],
  providers: [DialogService],
  templateUrl: './timesheet-shifts-page.component.html',
  styleUrl: './timesheet-shifts-page.component.scss'
})
export class TimesheetShiftsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly shiftsService = inject(ShiftsService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmService = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  readonly shifts = signal<Shift[]>([]);
  readonly isLoading = signal(false);
  readonly search = signal('');

  readonly shortTime = shortTime;
  readonly isOvernight = isOvernight;

  readonly groups = computed<ShiftGroup[]>(() => {
    const query = this.search().trim().toLowerCase();
    const list = [...this.shifts()]
      .filter(s => !query || [s.code, s.description].some(v => v?.toLowerCase().includes(query)))
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.code.localeCompare(b.code, 'uk'));
    return [
      {key: 'work', title: 'Робочі зміни', hint: 'Мають час початку й кінця', shifts: list.filter(s => s.type === ShiftType.workday)},
      {key: 'absence', title: 'Відсутності', hint: 'Відпустки, вихідні, свята та інше', shifts: list.filter(s => s.type !== ShiftType.workday)}
    ];
  });

  ngOnInit(): void {
    this.loadShifts();
  }

  loadShifts(): void {
    this.isLoading.set(true);
    this.shiftsService.getShifts()
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(shifts => this.shifts.set(shifts));
  }

  typeMeta(shift: Shift) {
    return SHIFT_TYPE_META[shift.type] ?? SHIFT_TYPE_META[ShiftType.none];
  }

  duration(shift: Shift): string {
    return formatDuration(shiftMinutes(shift.startTime, shift.endTime));
  }

  openDialog(shift?: Shift): void {
    const ref = this.dialogService.open(ShiftDialogComponent, {
      showHeader: false,
      modal: true,
      width: '560px',
      breakpoints: {'600px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data: {shift} satisfies ShiftDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.loadShifts());
  }

  confirmDelete(shift: Shift): void {
    this.confirmService.confirmDelete({
      entityName: 'зміну',
      itemName: shift.code,
      onConfirm: () => this.shiftsService.deleteShift(shift.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Зміну видалено');
          this.loadShifts();
        })
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
