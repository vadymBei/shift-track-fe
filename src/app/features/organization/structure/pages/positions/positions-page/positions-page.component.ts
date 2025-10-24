import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {GoBackComponent} from '../../../../../../shared/components/go-back/go-back.component';
import {PositionService} from '../../../services/position.service';
import {BsModalService} from 'ngx-bootstrap/modal';
import {delay, finalize, Subject, takeUntil} from 'rxjs';
import {Position} from '../../../models/position.model';
import {CommonModule} from '@angular/common';
import {
  CreatePositionModalComponent
} from '../../../components/positions/create-position-modal/create-position-modal.component';
import {
  EditPositionModalComponent
} from '../../../components/positions/edit-position-modal/edit-position-modal.component';
import {
  DeleteConfirmationModalComponent
} from '../../../../../../shared/components/delete-confirmation-modal/delete-confirmation-modal.component';

@Component({
  selector: 'app-positions-page',
  standalone: true,
  imports: [
    CommonModule,
    GoBackComponent
  ],
  templateUrl: './positions-page.component.html',
  styleUrl: './positions-page.component.scss'
})
export class PositionsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly positionService = inject(PositionService);
  readonly modalService = inject(BsModalService);

  positions = signal<Position[]>([]);
  isLoading = signal(false);

  ngOnInit(): void {
    this.getPositions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getPositions() {
    this.isLoading.set(true);

    this.positionService.getPositions()
      .pipe(
        delay(500),
        finalize(() => {
          this.isLoading.set(false);
        }),
        takeUntil(this.destroy$))
      .subscribe(positions => {
        this.positions.set(positions);
      });
  }

  openCreatePositionModal() {
    const ref = this.modalService.show(
      CreatePositionModalComponent,
      {
        class: 'modal-dialog-centered'
      });

    ref.onHidden?.subscribe({
      next: () => this.getPositions()
    });
  }

  openEditPositionModal(position: Position) {
    const ref = this.modalService.show(
      EditPositionModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          position: position
        }
      });

    ref.onHidden?.subscribe({
      next: () => this.getPositions()
    });
  }

  openDeleteConfirmation(position: Position): void {
    this.modalService.show(DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          itemName: position.name,
          entityName: 'посаду',
          onConfirm: () => this.deletePosition(position.id)
        }
      });
  }

  deletePosition(positionId: number) {
    this.positionService.deletePosition(positionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.getPositions()
      })
  }
}
