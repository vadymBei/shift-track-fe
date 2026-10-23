import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {catchError, debounceTime, finalize, of, Subject, takeUntil} from 'rxjs';
import {PrimeTemplate} from 'primeng/api';
import {TableModule} from 'primeng/table';
import {Button} from 'primeng/button';
import {Select} from 'primeng/select';
import {FloatLabel} from 'primeng/floatlabel';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {ToggleSwitch} from 'primeng/toggleswitch';
import {Tag} from 'primeng/tag';
import {Avatar} from 'primeng/avatar';
import {Tooltip} from 'primeng/tooltip';
import {DialogService} from 'primeng/dynamicdialog';
import {AccountService} from '../../../../../core/account/services/account.service';
import {EmployeesService} from '../../services/employees.service';
import {UnitService} from '../../../structure/services/unit.service';
import {DepartmentService} from '../../../structure/services/department.service';
import {Employee} from '../../models/employee.model';
import {Unit} from '../../../structure/models/unit.model';
import {Department} from '../../../structure/models/department.model';
import {EmployeeDialogComponent, EmployeeDialogData} from '../../components/employee-dialog/employee-dialog.component';
import {personInitials, pluralUk} from '../../../../../shared/utils/text.utils';
import {EmptyStateComponent} from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-employees-page',
  standalone: true,
  imports: [EmptyStateComponent, 
    FormsModule, ReactiveFormsModule, RouterLink, PrimeTemplate, TableModule, Button, Select, FloatLabel,
    IconField, InputIcon, InputText, ToggleSwitch, Tag, Avatar, Tooltip
  ],
  providers: [DialogService],
  templateUrl: './employees-page.component.html',
  styleUrl: './employees-page.component.scss'
})
export class EmployeesPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<void>();
  private readonly accountService = inject(AccountService);
  private readonly employeesService = inject(EmployeesService);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly dialogService = inject(DialogService);
  private readonly fb = inject(FormBuilder);
  private isInitialLoad = true;

  readonly form = this.fb.group({
    unitId: this.fb.control<number | null>(null),
    departmentId: this.fb.control<number | null>(null),
    searchPattern: ['']
  });

  readonly units = signal<Unit[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly isLoading = signal(false);
  readonly onlyUnassigned = signal(false);

  readonly visibleEmployees = computed(() => this.onlyUnassigned()
    ? this.employees().filter(e => !e.position || !e.department)
    : this.employees());

  readonly unassignedCount = computed(() => this.employees().filter(e => !e.position || !e.department).length);

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(400), takeUntil(this.destroy$))
      .subscribe(() => this.loadEmployees());

    this.unitService.getUnitsByRoles()
      .pipe(catchError(() => of([] as Unit[])), takeUntil(this.destroy$))
      .subscribe(units => {
        this.units.set(units);
        const userUnitId = this.accountService.currentUser()?.employee?.department?.unit?.id;
        if (this.isInitialLoad && userUnitId && units.some(u => u.id === userUnitId)) {
          this.form.patchValue({unitId: userUnitId}, {emitEvent: false});
          this.loadDepartments(userUnitId);
        } else {
          this.isInitialLoad = false;
          this.loadEmployees();
        }
      });
  }

  onUnitChange(unitId: number | null): void {
    this.isInitialLoad = false;
    this.form.patchValue({departmentId: null}, {emitEvent: false});
    this.departments.set([]);
    if (unitId) {
      this.loadDepartments(unitId);
    }
    this.loadEmployees();
  }

  private loadDepartments(unitId: number): void {
    this.departmentService.getDepartmentsByRoles(unitId)
      .pipe(catchError(() => of([] as Department[])), takeUntil(this.destroy$))
      .subscribe(departments => {
        this.departments.set(departments);
        const userDepartmentId = this.accountService.currentUser()?.employee?.departmentId;
        if (this.isInitialLoad && userDepartmentId && departments.some(d => d.id === userDepartmentId)) {
          this.form.patchValue({departmentId: userDepartmentId}, {emitEvent: false});
        }
        if (this.isInitialLoad) {
          this.loadEmployees();
        }
        this.isInitialLoad = false;
      });
  }

  onDepartmentChange(): void {
    this.loadEmployees();
  }

  onUnassignedToggle(value: boolean): void {
    this.onlyUnassigned.set(value);
    const controls = [this.form.controls.unitId, this.form.controls.departmentId];
    controls.forEach(c => value ? c.disable({emitEvent: false}) : c.enable({emitEvent: false}));
    this.loadEmployees();
  }

  onSearchInput(): void {
    this.search$.next();
  }

  loadEmployees(): void {
    const {unitId, departmentId, searchPattern} = this.form.getRawValue();
    const ignoreScope = this.onlyUnassigned();

    this.isLoading.set(true);
    this.employeesService.getAllEmployees({
      unitId: ignoreScope || departmentId ? undefined : unitId ?? undefined,
      departmentId: ignoreScope ? undefined : departmentId ?? undefined,
      searchPattern: searchPattern ?? ''
    })
      .pipe(catchError(() => of([] as Employee[])), finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(employees => this.employees.set(employees));
  }

  initials(employee: Employee): string {
    return personInitials(employee);
  }

  countLabel(count: number): string {
    return `${count} ${pluralUk(count, 'працівник', 'працівники', 'працівників')}`;
  }

  openEdit(employee: Employee): void {
    const ref = this.dialogService.open(EmployeeDialogComponent, {
      showHeader: false,
      modal: true,
      width: '760px',
      breakpoints: {'800px': '95vw'},
      contentStyle: {padding: '0'},
      focusOnShow: false,
      data: {employeeId: employee.id} satisfies EmployeeDialogData
    });
    ref.onClose.pipe(takeUntil(this.destroy$)).subscribe(changed => changed && this.loadEmployees());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
