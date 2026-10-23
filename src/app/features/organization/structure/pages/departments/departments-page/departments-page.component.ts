import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {RouterLink} from '@angular/router';
import {finalize, Subject, takeUntil} from 'rxjs';
import {Button} from 'primeng/button';
import {Tag} from 'primeng/tag';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Tooltip} from 'primeng/tooltip';
import {Skeleton} from 'primeng/skeleton';
import {DialogService} from 'primeng/dynamicdialog';
import {ConfirmService} from '../../../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../../../shared/services/notification.service';
import {DepartmentService} from '../../../services/department.service';
import {Department} from '../../../models/department.model';
import {GroupedDepartmentsByUnit} from '../../../models/grouped-departments-by-unit.model';
import {
  DepartmentDialogComponent,
  DepartmentDialogData
} from '../../../components/department-dialog/department-dialog.component';
import {pluralUk} from '../../../../../../shared/utils/text.utils';
import {EmptyStateComponent} from '../../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-departments-page',
  standalone: true,
  imports: [EmptyStateComponent, RouterLink, Button, Tag, IconField, InputIcon, InputText, Tooltip, Skeleton],
  providers: [DialogService],
  templateUrl: './departments-page.component.html',
  styleUrl: './departments-page.component.scss'
})
export class DepartmentsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly departmentService = inject(DepartmentService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmService = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  readonly groups = signal<GroupedDepartmentsByUnit[]>([]);
  readonly isLoading = signal(false);
  readonly search = signal('');

  readonly filteredGroups = computed(() => {
    const query = this.search().trim().toLowerCase();
    const groups = [...this.groups()].sort((a, b) => a.unit.name.localeCompare(b.unit.name, 'uk'));
    if (!query) {
      return groups;
    }
    return groups
      .map(group => group.unit.name.toLowerCase().includes(query)
        ? group
        : {...group, departments: group.departments.filter(d => d.name.toLowerCase().includes(query))})
      .filter(group => group.departments.length > 0 || group.unit.name.toLowerCase().includes(query));
  });

  readonly totalDepartments = computed(() => this.groups().reduce((sum, g) => sum + g.departments.length, 0));

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.isLoading.set(true);
    this.departmentService.getGroupedDepartmentsGroupedByUnits()
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(groups => this.groups.set(groups));
  }

  countLabel(count: number): string {
    return `${count} ${pluralUk(count, 'департамент', 'департаменти', 'департаментів')}`;
  }

  openDialog(data: DepartmentDialogData = {}): void {
    const ref = this.dialogService.open(DepartmentDialogComponent, {
      showHeader: false,
      modal: true,
      width: '480px',
      breakpoints: {'520px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.loadDepartments());
  }

  edit(department: Department, unitId: number): void {
    this.openDialog({department: {...department, unitId: department.unitId ?? unitId}});
  }

  confirmDelete(department: Department): void {
    this.confirmService.confirmDelete({
      entityName: 'департамент',
      itemName: department.name,
      onConfirm: () => this.departmentService.deleteDepartment(department.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Департамент видалено');
          this.loadDepartments();
        })
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
