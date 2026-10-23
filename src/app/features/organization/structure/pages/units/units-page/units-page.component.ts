import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {finalize, Subject, takeUntil} from 'rxjs';
import {PrimeTemplate} from 'primeng/api';
import {TableModule} from 'primeng/table';
import {Button} from 'primeng/button';
import {Tag} from 'primeng/tag';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Tooltip} from 'primeng/tooltip';
import {DialogService} from 'primeng/dynamicdialog';
import {ConfirmService} from '../../../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../../../shared/services/notification.service';
import {UnitService} from '../../../services/unit.service';
import {Unit} from '../../../models/unit.model';
import {UnitDialogComponent, UnitDialogData} from '../../../components/unit-dialog/unit-dialog.component';
import {EmptyStateComponent} from '../../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-units-page',
  standalone: true,
  imports: [EmptyStateComponent, RouterLink, PrimeTemplate, TableModule, Button, Tag, IconField, InputIcon, InputText, Tooltip],
  providers: [DialogService],
  templateUrl: './units-page.component.html',
  styleUrl: './units-page.component.scss'
})
export class UnitsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly unitService = inject(UnitService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmService = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  readonly units = signal<Unit[]>([]);
  readonly isLoading = signal(false);
  readonly search = signal('');

  readonly filteredUnits = computed(() => {
    const query = this.search().trim().toLowerCase();
    return !query
      ? this.units()
      : this.units().filter(u => [u.code, u.name, u.description].some(v => v?.toLowerCase().includes(query)));
  });

  ngOnInit(): void {
    this.loadUnits();
  }

  loadUnits(): void {
    this.isLoading.set(true);
    this.unitService.getUnits()
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(units => this.units.set(units));
  }

  openDialog(unit?: Unit): void {
    const ref = this.dialogService.open(UnitDialogComponent, {
      showHeader: false,
      modal: true,
      width: '480px',
      breakpoints: {'520px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data: {unit} satisfies UnitDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.loadUnits());
  }

  confirmDelete(unit: Unit): void {
    this.confirmService.confirmDelete({
      entityName: 'регіон',
      itemName: unit.name,
      onConfirm: () => this.unitService.deleteUnitById(unit.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Регіон видалено');
          this.loadUnits();
        })
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
