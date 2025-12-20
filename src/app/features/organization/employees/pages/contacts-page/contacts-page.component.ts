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
  private readonly employeeService = inject(EmployeesService);
  private readonly departmentService = inject(DepartmentService);
  private readonly unitService = inject(UnitService);
  private readonly fb = inject(FormBuilder);

  private readonly destroy$ = new Subject<void>();
  private readonly searchSubject$ = new Subject<string>();

  form!: FormGroup;
  request: AllEmployeesRequest = {
    searchPattern: '',
    departmentId: undefined
  };

  employees = signal<Employee[]>([]);
  units = signal<Unit[]>([]);
  departments = signal<Department[]>([]);
  isLoading = signal(false);
  errorMessage = signal('');

  ngOnInit(): void {
    this.initializeForm();

    this.searchSubject$
      .pipe(
        debounceTime(500),
        takeUntil(this.destroy$)
      )
      .subscribe(searchPattern => {
        this.request.searchPattern = searchPattern;
        this.getEmployees();
      });

    this.getUnits();
    this.getEmployees();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  initializeForm(): void {
    this.form = this.fb.group({
      searchPattern: [''],
      unitId: [null],
      departmentId: [null]
    });
  }

  onSearchChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchSubject$.next(inputElement.value);
  }

  onUnitChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (unitId === 'null') {
      this.request.departmentId = undefined;
      this.departments.set([]);
      this.form.get('departmentId')?.setValue(null);
    } else {
      const numericUnitId = Number(unitId);
      this.getDepartmentsByUnitId(numericUnitId);
    }

    this.getEmployees();
  }

  onDepartmentChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const departmentId = selectElement.value;

    this.request.departmentId = departmentId === 'null'
      ? undefined
      : Number(departmentId);

    this.getEmployees();
  }

  getEmployees(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.employeeService.getAllEmployees(this.request)
      .pipe(
        catchError(error => {
          this.errorMessage.set('Failed to load employees. Please try again.');
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

  getUnits(): void {
    this.unitService.getUnits()
      .pipe(
        catchError(error => {
          return of([] as Unit[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(units => {
        this.units.set(units);
      });
  }

  getDepartmentsByUnitId(unitId: number): void {
    this.departmentService.getDepartmentsByUnitId(unitId)
      .pipe(
        catchError(error => {
          return of([] as Department[]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(departments => {
        this.departments.set(departments);
      });
  }
}
