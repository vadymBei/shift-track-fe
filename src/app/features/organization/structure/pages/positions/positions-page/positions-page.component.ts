import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {finalize, Subject, takeUntil} from 'rxjs';
import {PrimeTemplate} from 'primeng/api';
import {TableModule} from 'primeng/table';
import {Button} from 'primeng/button';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Tooltip} from 'primeng/tooltip';
import {DialogService} from 'primeng/dynamicdialog';
import {ConfirmService} from '../../../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../../../shared/services/notification.service';
import {PositionService} from '../../../services/position.service';
import {Position} from '../../../models/position.model';
import {PositionDialogComponent, PositionDialogData} from '../../../components/position-dialog/position-dialog.component';
import {EmptyStateComponent} from '../../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-positions-page',
  standalone: true,
  imports: [EmptyStateComponent, RouterLink, PrimeTemplate, TableModule, Button, IconField, InputIcon, InputText, Tooltip],
  providers: [DialogService],
  templateUrl: './positions-page.component.html',
  styleUrl: './positions-page.component.scss'
})
export class PositionsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly positionService = inject(PositionService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmService = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  readonly positions = signal<Position[]>([]);
  readonly isLoading = signal(false);
  readonly search = signal('');

  readonly filteredPositions = computed(() => {
    const query = this.search().trim().toLowerCase();
    return !query
      ? this.positions()
      : this.positions().filter(p => [p.name, p.description].some(v => v?.toLowerCase().includes(query)));
  });

  ngOnInit(): void {
    this.loadPositions();
  }

  loadPositions(): void {
    this.isLoading.set(true);
    this.positionService.getPositions()
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(positions => this.positions.set(positions));
  }

  openDialog(position?: Position): void {
    const ref = this.dialogService.open(PositionDialogComponent, {
      showHeader: false,
      modal: true,
      width: '480px',
      breakpoints: {'520px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data: {position} satisfies PositionDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.loadPositions());
  }

  confirmDelete(position: Position): void {
    this.confirmService.confirmDelete({
      entityName: 'посаду',
      itemName: position.name,
      onConfirm: () => this.positionService.deletePosition(position.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Посаду видалено');
          this.loadPositions();
        })
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
