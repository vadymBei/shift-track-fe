import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {catchError, finalize, Observable, of, Subject, takeUntil} from 'rxjs';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {NotificationService} from '../../../../shared/services/notification.service';
import {UnitService} from '../../../../features/organization/structure/services/unit.service';
import {DepartmentService} from '../../../../features/organization/structure/services/department.service';
import {EmployeeRoleUnitsService} from '../../services/employee-role-units.service';
import {EmployeeRoleUnitDepartmentsService} from '../../services/employee-role-unit-departments.service';

export type RoleAccessDialogData =
  | {mode: 'unit'; employeeRoleId: number; roleTitle: string; excludeIds: number[]}
  | {mode: 'department'; employeeRoleUnitId: number; unitId: number; roleTitle: string; unitName: string; excludeIds: number[]};

interface Option {
  id: number;
  name: string;
}

@Component({
  selector: 'app-role-access-dialog',
  standalone: true,
  imports: [FormsModule, Button, Select],
  template: `
    <div class="form-dialog">
      <header class="form-dialog-header">
        <div>
          <h2 class="form-dialog-title">{{ isUnit ? 'Додати регіон' : 'Додати департамент' }}</h2>
          <p class="form-dialog-subtitle">{{ subtitle }}</p>
        </div>
        <p-button icon="pi pi-times" [rounded]="true" [text]="true" severity="secondary" ariaLabel="Закрити" (onClick)="close()"/>
      </header>

      <div class="form-dialog-body">
        <div class="form-field">
          <label for="accessTarget">{{ isUnit ? 'Регіон' : 'Департамент' }}</label>
          <p-select inputId="accessTarget" [options]="options()" optionLabel="name" optionValue="id"
                    [ngModel]="selectedId()" (ngModelChange)="selectedId.set($event)" [loading]="isLoading()"
                    [filter]="options().length > 8" [placeholder]="isUnit ? 'Оберіть регіон' : 'Оберіть департамент'"
                    [emptyMessage]="isUnit ? 'Усі регіони вже додано' : 'Усі департаменти вже додано'" [fluid]="true"/>
        </div>

        <footer class="form-dialog-footer">
          <p-button label="Скасувати" [text]="true" severity="secondary" (onClick)="close()"/>
          <p-button label="Додати" icon="pi pi-plus" [disabled]="!selectedId() || isSaving()" [loading]="isSaving()" (onClick)="save()"/>
        </footer>
      </div>
    </div>
  `
})
export class RoleAccessDialogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly roleUnitsService = inject(EmployeeRoleUnitsService);
  private readonly roleUnitDepartmentsService = inject(EmployeeRoleUnitDepartmentsService);
  private readonly notifications = inject(NotificationService);
  private readonly data = inject<DynamicDialogConfig<RoleAccessDialogData>>(DynamicDialogConfig).data!;

  readonly isUnit = this.data.mode === 'unit';
  readonly subtitle = this.data.mode === 'unit'
    ? `Роль «${this.data.roleTitle}»`
    : `Роль «${this.data.roleTitle}» · ${this.data.unitName}`;

  private readonly all = signal<Option[]>([]);
  readonly options = computed(() => this.all().filter(o => !this.data.excludeIds.includes(o.id)));
  readonly selectedId = signal<number | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);

  ngOnInit(): void {
    const source$: Observable<Option[]> = this.data.mode === 'unit'
      ? this.unitService.getUnits()
      : this.departmentService.getDepartmentsByUnitId(this.data.unitId);

    source$
      .pipe(catchError(() => of([] as Option[])), finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(options => this.all.set(options));
  }

  save(): void {
    const id = this.selectedId();
    if (!id) return;
    const name = this.all().find(o => o.id === id)?.name ?? '';

    const request$: Observable<unknown> = this.data.mode === 'unit'
      ? this.roleUnitsService.create({employeeRoleId: this.data.employeeRoleId, unitId: id})
      : this.roleUnitDepartmentsService.create({employeeRoleUnitId: this.data.employeeRoleUnitId, departmentId: id});

    this.isSaving.set(true);
    request$
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success(`${this.isUnit ? 'Регіон' : 'Департамент'} «${name}» додано`);
        this.ref.close(true);
      });
  }

  close(): void {
    this.ref.close(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
