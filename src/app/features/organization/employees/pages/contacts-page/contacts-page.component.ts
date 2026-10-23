import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {catchError, debounceTime, finalize, of, Subject, takeUntil} from 'rxjs';
import {PrimeTemplate} from 'primeng/api';
import {Select} from 'primeng/select';
import {FloatLabel} from 'primeng/floatlabel';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Avatar} from 'primeng/avatar';
import {Button} from 'primeng/button';
import {Tooltip} from 'primeng/tooltip';
import {Skeleton} from 'primeng/skeleton';
import {Drawer} from 'primeng/drawer';
import {AccountService} from '../../../../../core/account/services/account.service';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {EmployeesService} from '../../services/employees.service';
import {UnitService} from '../../../structure/services/unit.service';
import {DepartmentService} from '../../../structure/services/department.service';
import {Employee} from '../../models/employee.model';
import {Unit} from '../../../structure/models/unit.model';
import {Department} from '../../../structure/models/department.model';
import {ContactDetailsComponent} from '../../components/contact-details/contact-details.component';
import {personInitials} from '../../../../../shared/utils/text.utils';
import {EmptyStateComponent} from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-contacts-page',
  standalone: true,
  imports: [EmptyStateComponent, 
    ReactiveFormsModule, PrimeTemplate, Select, FloatLabel, IconField, InputIcon, InputText,
    Avatar, Button, Tooltip, Skeleton, Drawer, ContactDetailsComponent
  ],
  templateUrl: './contacts-page.component.html',
  styleUrl: './contacts-page.component.scss'
})
export class ContactsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<void>();
  private readonly accountService = inject(AccountService);
  private readonly employeesService = inject(EmployeesService);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly notifications = inject(NotificationService);
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
  readonly hasScope = signal(false);
  readonly selected = signal<Employee | null>(null);
  readonly skeletons = [1, 2, 3, 4, 5, 6];

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

  onSearchInput(): void {
    this.search$.next();
  }

  loadEmployees(): void {
    const {unitId, departmentId, searchPattern} = this.form.getRawValue();
    if (!unitId && !departmentId) {
      this.hasScope.set(false);
      this.employees.set([]);
      return;
    }
    this.hasScope.set(true);

    this.isLoading.set(true);
    this.employeesService.getAllEmployees({
      unitId: departmentId ? undefined : unitId ?? undefined,
      departmentId: departmentId ?? undefined,
      searchPattern: searchPattern ?? ''
    })
      .pipe(catchError(() => of([] as Employee[])), finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(employees => this.employees.set(
        [...employees].sort((a, b) => (a.fullName ?? '').localeCompare(b.fullName ?? '', 'uk'))
      ));
  }

  initials(employee: Employee): string {
    return personInitials(employee);
  }

  copyPhone(employee: Employee, event: Event): void {
    event.stopPropagation();
    if (!employee.phoneNumber) return;
    navigator.clipboard?.writeText(employee.phoneNumber)
      .then(() => this.notifications.success('Телефон скопійовано'))
      .catch(() => this.notifications.warn('Не вдалося скопіювати'));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
