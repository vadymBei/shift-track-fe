import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {catchError, finalize, of, Subject, takeUntil} from 'rxjs';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {MultiSelect} from 'primeng/multiselect';
import {Skeleton} from 'primeng/skeleton';
import {NotificationService} from '../../../../shared/services/notification.service';
import {UnitService} from '../../../../features/organization/structure/services/unit.service';
import {DepartmentService} from '../../../../features/organization/structure/services/department.service';
import {Unit} from '../../../../features/organization/structure/models/unit.model';
import {Department} from '../../../../features/organization/structure/models/department.model';
import {Employee} from '../../../../features/organization/employees/models/employee.model';
import {RolesService} from '../../services/roles.service';
import {EmployeeRolesService} from '../../services/employee-roles.service';
import {Role} from '../../models/role.model';
import {roleMeta, roleTitle} from '../../constants/role-meta';

export interface EmployeeRoleDialogData {
  employee: Employee;
  assignedRoleIds: number[];
}

@Component({
  selector: 'app-employee-role-dialog',
  standalone: true,
  imports: [FormsModule, Button, Select, MultiSelect, Skeleton],
  templateUrl: './employee-role-dialog.component.html',
  styleUrl: './employee-role-dialog.component.scss'
})
export class EmployeeRoleDialogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly rolesService = inject(RolesService);
  private readonly employeeRolesService = inject(EmployeeRolesService);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly notifications = inject(NotificationService);
  private readonly data = inject<DynamicDialogConfig<EmployeeRoleDialogData>>(DynamicDialogConfig).data!;

  readonly employee = this.data.employee;
  readonly roleMeta = roleMeta;
  readonly roleTitle = roleTitle;

  readonly roles = signal<Role[]>([]);
  readonly units = signal<Unit[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly rolesLoading = signal(true);
  readonly isSaving = signal(false);

  readonly roleId = signal<number | null>(null);
  readonly unitId = signal<number | null>(null);
  readonly departmentIds = signal<number[]>([]);

  readonly availableRoles = computed(() => this.roles().filter(r => !this.data.assignedRoleIds.includes(r.id)));
  readonly selectedRole = computed(() => this.roles().find(r => r.id === this.roleId()) ?? null);
  readonly canSave = computed(() => !!this.roleId() && !this.isSaving());

  ngOnInit(): void {
    this.rolesService.getRoles()
      .pipe(catchError(() => of([] as Role[])), finalize(() => this.rolesLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(roles => this.roles.set(roles));

    this.unitService.getUnits()
      .pipe(catchError(() => of([] as Unit[])), takeUntil(this.destroy$))
      .subscribe(units => this.units.set(units));
  }

  onUnitChange(unitId: number | null): void {
    this.unitId.set(unitId);
    this.departmentIds.set([]);
    this.departments.set([]);
    if (unitId) {
      this.departmentService.getDepartmentsByUnitId(unitId)
        .pipe(catchError(() => of([] as Department[])), takeUntil(this.destroy$))
        .subscribe(departments => this.departments.set(departments));
    }
  }

  save(): void {
    const roleId = this.roleId();
    if (!roleId || !this.canSave()) return;

    this.isSaving.set(true);
    this.employeeRolesService.create({
      employeeId: this.employee.id,
      roleId,
      unitId: this.unitId() ?? undefined,
      departmentIds: this.departmentIds()
    })
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success(`Роль «${roleTitle(this.selectedRole())}» призначено`);
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
