import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {GoBackComponent} from '../../../../../../shared/components/go-back/go-back.component';
import {delay, finalize, Subject, takeUntil} from 'rxjs';
import {CommonModule} from '@angular/common';
import {Shift} from '../../../models/shift.model';
import {ShiftsService} from '../../../services/shifts.service';
import {
  DeleteConfirmationModalComponent
} from '../../../../../../shared/components/delete-confirmation-modal/delete-confirmation-modal.component';
import {BsModalService} from 'ngx-bootstrap/modal';
import {EditShiftModalComponent} from '../../../components/shifts/edit-shift-modal/edit-shift-modal.component';
import {CreateShiftModalComponent} from '../../../components/shifts/create-shift-modal/create-shift-modal.component';
import {TimeSpanHoursMinutesFormatPipe} from '../../../../../../shared/pipes/time-span-hours-minutes-format.pipe';

@Component({
  selector: 'app-timesheet-shifts-page',
  standalone: true,
  imports: [
    CommonModule,
    GoBackComponent,
    TimeSpanHoursMinutesFormatPipe
  ],
  templateUrl: './timesheet-shifts-page.component.html',
  styleUrl: './timesheet-shifts-page.component.scss'
})
export class TimesheetShiftsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly modalService = inject(BsModalService);
  private readonly shiftsService = inject(ShiftsService);

  shifts = signal<Shift[]>([]);
  isLoading = signal(false);

  ngOnInit(): void {
    this.getShifts();
  }

  getShifts() {
    this.isLoading.set(true);

    this.shiftsService.getShifts()
      .pipe(
        delay(500),
        finalize(() => {
          this.isLoading.set(false);
        }),
        takeUntil(this.destroy$))
      .subscribe(shifts => {
        this.shifts.set(shifts);
      })
  }

  openCreateShiftModal() {
    const ref = this.modalService.show(
      CreateShiftModalComponent,
      {
        class: 'modal-dialog-centered',
      });

    ref.onHidden?.subscribe({
      next: () => this.getShifts()
    });
  }

  openEditShiftModal(shift: Shift) {
    const ref = this.modalService.show(
      EditShiftModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          shift: shift
        }
      });

    ref.onHidden?.subscribe({
      next: () => this.getShifts()
    });
  }

  openDeleteConfirmation(shift: Shift) {
    this.modalService.show(
      DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          itemName: shift.code,
          entityName: 'зміну',
          onConfirm: () => this.deleteShift(shift.id)
        }
      });
  }

  deleteShift(shiftId: number) {
    this.shiftsService.deleteShift(shiftId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.getShifts()
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
