import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {UnitService} from '../../../services/unit.service';
import {delay, finalize, Subject, takeUntil} from 'rxjs';
import {Unit} from '../../../models/unit.model';
import {CommonModule} from '@angular/common';
import {BsModalService} from 'ngx-bootstrap/modal';
import {EditUnitModalComponent} from '../../../components/units/edit-unit-modal/edit-unit-modal.component';
import {GoBackComponent} from '../../../../../../shared/components/go-back/go-back.component';
import {CreateUnitModalComponent} from '../../../components/units/create-unit-modal/create-unit-modal.component';
import {
  DeleteConfirmationModalComponent
} from '../../../../../../shared/components/delete-confirmation-modal/delete-confirmation-modal.component';

@Component({
  selector: 'app-units-page',
  standalone: true,
  imports: [
    CommonModule,
    GoBackComponent
  ],
  templateUrl: './units-page.component.html',
  styleUrl: './units-page.component.scss'
})
export class UnitsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly unitService = inject(UnitService);
  readonly modalService = inject(BsModalService);

  units = signal<Unit[]>([]);
  isLoading = signal(false);

  ngOnInit(): void {
    this.getUnits();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getUnits() {
    this.isLoading.set(true);

    this.unitService.getUnits()
      .pipe(
        delay(500),
        finalize(() => {
          this.isLoading.set(false);
        }),
        takeUntil(this.destroy$))
      .subscribe(units => {
        this.units.set(units);
      });
  }

  openEditUnitModal(unit: Unit) {
    const ref = this.modalService.show(
      EditUnitModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          unit: unit
        }
      }
    );

    ref.onHidden?.subscribe({
      next: () => this.getUnits()
    })
  }

  openCreateUnitModal() {
    const ref = this.modalService.show(
      CreateUnitModalComponent,
      {
        class: 'modal-dialog-centered',
      });

    ref.onHidden?.subscribe({
      next: () => this.getUnits()
    });
  }

  openDeleteConfirmation(unit: Unit): void {
    this.modalService.show(
      DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          itemName: unit.name,
          entityName: 'регіон',
          onConfirm: () => this.deleteUnit(unit.id)
        }
      });
  }

  deleteUnit(unitId: number) {
    this.unitService.deleteUnitById(unitId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.getUnits()
      })
  }
}
