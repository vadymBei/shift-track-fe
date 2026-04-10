import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {EmployeesService} from "../../services/employees.service";
import {DepartmentService} from "../../../structure/services/department.service";
import {UnitService} from "../../../structure/services/unit.service";
import {catchError, delay, finalize, of, Subject, takeUntil} from "rxjs";
import {AllEmployeesRequest} from "../../models/all-employees-request.model";
import {Employee} from "../../models/employee.model";
import {Unit} from "../../../structure/models/unit.model";
import {Department} from "../../../structure/models/department.model";
import {debounceTime} from "rxjs/operators";
import {CommonModule} from "@angular/common";
import {EmployeeDetailsModalComponent} from "../../components/employee-details-modal/employee-details-modal.component";
import {BsModalService} from "ngx-bootstrap/modal";
import {AccountService} from "../../../../../core/account/services/account.service";

@Component({
  selector: 'app-contacts-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './contacts-page.component.html',
  styleUrl: './contacts-page.component.scss'
})
export class ContactsPageComponent implements OnInit, OnDestroy {
  private readonly accountService = inject(AccountService);
  private readonly employeeService = inject(EmployeesService);
  private readonly departmentService = inject(DepartmentService);
  private readonly unitService = inject(UnitService);
  private readonly fb = inject(FormBuilder);
  private readonly modalService = inject(BsModalService);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  private isInitialLoad = true;
  private wasDepartmentSelected = false;
  private wasUnitSelected = false;
  form: FormGroup = this.fb.group({
    searchPattern: [''],
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
  isLoading = signal(false);

  ngOnInit(): void {
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

    this.getUnitsByRoles();
  }

  private getUnitsByRoles() {
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

  onUnitChange(event: Event) {
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

  private getEmployees() {
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

  private getDepartmentsByRoles(unitId: number) {
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

  onSearchChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.searchSubject$.next(inputElement.value);
  }

  openEmployeeDetailsModal(employee: Employee) {
    this.modalService.show(
      EmployeeDetailsModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          employee: employee
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
