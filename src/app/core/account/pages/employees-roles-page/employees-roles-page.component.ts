import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {catchError, finalize, forkJoin, map, Observable, of, Subject, switchMap, takeUntil} from 'rxjs';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Avatar} from 'primeng/avatar';
import {Tag} from 'primeng/tag';
import {Tooltip} from 'primeng/tooltip';
import {Skeleton} from 'primeng/skeleton';
import {DialogService} from 'primeng/dynamicdialog';
import {ConfirmService} from '../../../../shared/services/confirm.service';
import {NotificationService} from '../../../../shared/services/notification.service';
import {Employee} from '../../../../features/organization/employees/models/employee.model';
import {EmployeesService} from '../../../../features/organization/employees/services/employees.service';
import {Unit} from '../../../../features/organization/structure/models/unit.model';
import {UnitService} from '../../../../features/organization/structure/services/unit.service';
import {EmployeeRole} from '../../models/employee-role.model';
import {EmployeeRoleUnit} from '../../models/employee-role-unit.model';
import {EmployeeRoleUnitDepartment} from '../../models/employee-role-unit-department.model';
import {EmployeeRolesService} from '../../services/employee-roles.service';
import {EmployeeRoleUnitsService} from '../../services/employee-role-units.service';
import {EmployeeRoleUnitDepartmentsService} from '../../services/employee-role-unit-departments.service';
import {ROLE_SCOPE_META, roleMeta, roleTitle} from '../../constants/role-meta';
import {RoleScope} from '../../enums/role-scope.enum';
import {
  EmployeeRoleDialogComponent,
  EmployeeRoleDialogData
} from '../../components/employee-role-dialog/employee-role-dialog.component';
import {
  RoleAccessDialogComponent,
  RoleAccessDialogData
} from '../../components/role-access-dialog/role-access-dialog.component';
import {personInitials} from '../../../../shared/utils/text.utils';
import {EmptyStateComponent} from '../../../../shared/components/empty-state/empty-state.component';

interface UnitNode {
  roleUnit: EmployeeRoleUnit;
  departments: EmployeeRoleUnitDepartment[];
}

interface RoleNode {
  employeeRole: EmployeeRole;
  units: UnitNode[];
}

const DIALOG_OPTIONS = {
  showHeader: false,
  modal: true,
  dismissableMask: true,
  contentStyle: {padding: '0'},
  focusOnShow: false
};

@Component({
  selector: 'app-employees-roles-page',
  standalone: true,
  imports: [EmptyStateComponent, FormsModule, RouterLink, Button, Select, IconField, InputIcon, InputText, Avatar, Tag, Tooltip, Skeleton],
  providers: [DialogService],
  templateUrl: './employees-roles-page.component.html',
  styleUrl: './employees-roles-page.component.scss'
})
export class EmployeesRolesPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly reloadRoles$ = new Subject<void>();
  private readonly unitService = inject(UnitService);
  private readonly employeeService = inject(EmployeesService);
  private readonly employeeRolesService = inject(EmployeeRolesService);
  private readonly roleUnitsService = inject(EmployeeRoleUnitsService);
  private readonly roleUnitDepartmentsService = inject(EmployeeRoleUnitDepartmentsService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmService = inject(ConfirmService);
  private readonly notifications = inject(NotificationService);

  readonly roleMeta = roleMeta;
  readonly roleTitle = roleTitle;
  readonly scopeMeta = ROLE_SCOPE_META;
  readonly RoleScope = RoleScope;

  readonly units = signal<Unit[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly unitId = signal<number | null>(null);
  readonly search = signal('');
  readonly employeesLoading = signal(false);

  readonly selected = signal<Employee | null>(null);
  readonly roles = signal<RoleNode[]>([]);
  readonly rolesLoading = signal(false);

  readonly visibleEmployees = computed(() => {
    const query = this.search().trim().toLowerCase();
    if (!query) return this.employees();
    return this.employees().filter(e =>
      e.fullName?.toLowerCase().includes(query)
      || e.position?.name?.toLowerCase().includes(query)
      || e.department?.name?.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    this.unitService.getUnits()
      .pipe(catchError(() => of([] as Unit[])), takeUntil(this.destroy$))
      .subscribe(units => this.units.set(units));

    this.loadEmployees();

    this.reloadRoles$
      .pipe(
        switchMap(() => {
          const employee = this.selected();
          if (!employee) return of([] as RoleNode[]);
          this.rolesLoading.set(true);
          return this.loadRoleTree(employee.id).pipe(
            catchError(() => of([] as RoleNode[])),
            finalize(() => this.rolesLoading.set(false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(roles => this.roles.set(roles));
  }

  onUnitChange(unitId: number | null): void {
    this.unitId.set(unitId);
    this.loadEmployees();
  }

  private loadEmployees(): void {
    this.employeesLoading.set(true);
    this.employeeService.getAllEmployees({unitId: this.unitId() ?? undefined})
      .pipe(
        catchError(() => of([] as Employee[])),
        finalize(() => this.employeesLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe(employees => this.employees.set(
        [...employees].sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'uk'))
      ));
  }

  selectEmployee(employee: Employee): void {
    if (this.selected()?.id === employee.id) return;
    this.selected.set(employee);
    this.roles.set([]);
    this.reloadRoles$.next();
  }

  initials(employee: Employee | null | undefined): string {
    return personInitials(employee);
  }

  private loadRoleTree(employeeId: number): Observable<RoleNode[]> {
    return this.employeeRolesService.getEmployeeRolesByEmployeeId(employeeId).pipe(
      switchMap(employeeRoles => employeeRoles.length
        ? forkJoin(employeeRoles.map(employeeRole => this.loadUnits(employeeRole)))
        : of([] as RoleNode[]))
    );
  }

  private loadUnits(employeeRole: EmployeeRole): Observable<RoleNode> {
    return this.roleUnitsService.getByEmployeeRoleId(employeeRole.id).pipe(
      catchError(() => of([] as EmployeeRoleUnit[])),
      switchMap(roleUnits => roleUnits.length
        ? forkJoin(roleUnits.map(roleUnit => this.roleUnitDepartmentsService.getByEmployeeRoleUnitId(roleUnit.id).pipe(
          catchError(() => of([] as EmployeeRoleUnitDepartment[])),
          map(departments => ({roleUnit, departments}))
        )))
        : of([] as UnitNode[])),
      map(units => ({employeeRole, units}))
    );
  }

  openAssignRole(): void {
    const employee = this.selected();
    if (!employee) return;
    const ref = this.dialogService.open(EmployeeRoleDialogComponent, {
      ...DIALOG_OPTIONS,
      width: '640px',
      breakpoints: {'700px': '95vw'},
      data: {
        employee,
        assignedRoleIds: this.roles().map(r => r.employeeRole.role.id)
      } satisfies EmployeeRoleDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.reloadRoles$.next());
  }

  openAddUnit(node: RoleNode): void {
    this.openAccessDialog({
      mode: 'unit',
      employeeRoleId: node.employeeRole.id,
      roleTitle: roleTitle(node.employeeRole.role),
      excludeIds: node.units.map(u => u.roleUnit.unit.id)
    });
  }

  openAddDepartment(node: RoleNode, unit: UnitNode): void {
    this.openAccessDialog({
      mode: 'department',
      employeeRoleUnitId: unit.roleUnit.id,
      unitId: unit.roleUnit.unit.id,
      unitName: unit.roleUnit.unit.name,
      roleTitle: roleTitle(node.employeeRole.role),
      excludeIds: unit.departments.map(d => d.department.id)
    });
  }

  private openAccessDialog(data: RoleAccessDialogData): void {
    const ref = this.dialogService.open(RoleAccessDialogComponent, {
      ...DIALOG_OPTIONS,
      width: '460px',
      breakpoints: {'520px': '95vw'},
      data
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.reloadRoles$.next());
  }

  confirmDeleteRole(node: RoleNode): void {
    this.confirmService.confirmDelete({
      entityName: 'роль',
      itemName: roleTitle(node.employeeRole.role),
      onConfirm: () => this.employeeRolesService.delete(node.employeeRole.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Роль видалено');
          this.reloadRoles$.next();
        })
    });
  }

  confirmDeleteUnit(unit: UnitNode): void {
    this.confirmService.confirmDelete({
      entityName: 'регіон',
      itemName: unit.roleUnit.unit.name,
      onConfirm: () => this.roleUnitsService.deleteById(unit.roleUnit.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Регіон прибрано з ролі');
          this.reloadRoles$.next();
        })
    });
  }

  confirmDeleteDepartment(department: EmployeeRoleUnitDepartment): void {
    this.confirmService.confirmDelete({
      entityName: 'департамент',
      itemName: department.department.name,
      onConfirm: () => this.roleUnitDepartmentsService.delete(department.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.notifications.success('Департамент прибрано з ролі');
          this.reloadRoles$.next();
        })
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
