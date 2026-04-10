import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {EmployeesService} from '../../services/employees.service';
import {UnitService} from '../../../structure/services/unit.service';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {catchError, debounceTime, delay, finalize, of, Subject, takeUntil} from 'rxjs';
import {AllEmployeesRequest} from '../../models/all-employees-request.model';
import {Employee} from '../../models/employee.model';
import {Unit} from '../../../structure/models/unit.model';
import {CommonModule} from '@angular/common';
import {DepartmentService} from '../../../structure/services/department.service';
import {Department} from '../../../structure/models/department.model';
import {BsModalService, ModalOptions} from 'ngx-bootstrap/modal';
import {EditEmployeeModalComponent} from '../../components/edit-employee-modal/edit-employee-modal.component';
import {AccountService} from "../../../../../core/account/services/account.service";

@Component({
  selector: 'app-employees-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  templateUrl: './employees-page.component.html',
  styleUrl: './employees-page.component.scss'
})
export class EmployeesPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private readonly accountService = inject(AccountService);
  private readonly departmentService = inject(DepartmentService);
  private readonly employeeService = inject(EmployeesService);
  private readonly unitService = inject(UnitService);
  private readonly modalService = inject(BsModalService);

  private isInitialLoad = true;
  private wasDepartmentSelected = false;
  private wasUnitSelected = false;
  searchSubject$: Subject<string> = new Subject<string>();
  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group({
    searchPattern: [undefined],
    unitId: [null],
    departmentId: [null]
  });

  request = signal<AllEmployeesRequest>({
    searchPattern: '',
    departmentId: undefined
  });
  employees = signal<Employee[]>([]);
  units = signal<Unit[]>([]);
  departments = signal<Department[]>([]);
  unitId?: number;
  isLoading = signal(false);

  ngOnInit(): void {
    this.setupSearchSubscription();

    this.getUnitsByRoles();
  }

  private setupSearchSubscription() {
    this.searchSubject$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(searchPattern => {
        this.request.update(req => ({
          ...req,
          searchPattern: searchPattern
        }));

        this.getEmployees();
      });
  }

  private getEmployees(): void {
    this.isLoading.set(true);

    this.employeeService.getAllEmployees(this.request())
      .pipe(
        catchError(_ => {
          return of([] as Employee[]);
        }),
        delay(500),
        finalize(() => {
          this.isLoading.set(false);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(employees => {
        this.employees.set(employees);
      });
  }

  private getUnitsByRoles(): void {
    this.unitService.getUnitsByRoles()
      .pipe(
        catchError(_ => {
          return of([] as Unit[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(units => {
        this.units.set(units);

        const currentUserUnitId = this.accountService.currentUser()?.employee?.department?.unit?.id;

        if (this.isInitialLoad && currentUserUnitId && units.some(u => u.id === currentUserUnitId)) {

          this.form.get('unitId')?.setValue(currentUserUnitId);

          this.wasUnitSelected = true;

          this.getDepartmentsByRoles(currentUserUnitId);
        } else {
          this.isInitialLoad = false;
        }
      });
  }

  private getDepartmentsByRoles(unitId: number): void {
    this.departmentService.getDepartmentsByRoles(unitId)
      .pipe(
        catchError(_ => {
          return of([] as Department[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(departments => {
        this.departments.set(departments);

        const currentUserDepartmentId = this.accountService.currentUser()?.employee?.departmentId;

        if (this.isInitialLoad && currentUserDepartmentId && departments.some(d => d.id === currentUserDepartmentId)) {
          this.form.get('departmentId')?.setValue(currentUserDepartmentId);

          this.request.update(req => ({
            ...req,
            departmentId: currentUserDepartmentId
          }));

          this.wasDepartmentSelected = true;

          this.getEmployees();
        }

        this.isInitialLoad = false;
      });
  }

  onSearchChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.searchSubject$.next(inputElement.value);
  }

  onUnitChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (unitId !== 'null') {
      this.wasDepartmentSelected = false;
      this.getDepartmentsByRoles(Number(unitId));
    }

    this.departments.set([]);
    this.form.get('departmentId')?.setValue(null);

    this.employees.set([]);
    this.wasUnitSelected = true;
  }

  onDepartmentChange(event: Event) {
    if (!this.request)
      return;

    const selectElement = event.target as HTMLSelectElement;
    const departmentId = selectElement.value;

    if (departmentId == 'null')
      this.request.update(req => ({
        ...req,
        departmentId: undefined
      }));
    else
      this.request.update(req => ({
        ...req,
        departmentId: Number(departmentId)
      }));

    this.wasDepartmentSelected = true;

    this.getEmployees();
  }

  openEditEmployeeModal(employeeId: number) {
    const initialState: ModalOptions = {
      class: 'modal-dialog-centered',
      initialState: {
        employeeId: employeeId,
      }
    }

    const ref = this.modalService.show(EditEmployeeModalComponent, initialState);

    ref.onHidden?.subscribe({
      next: () => this.getEmployees()
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
