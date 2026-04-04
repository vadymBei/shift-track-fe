import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {EmployeesService} from '../../services/employees.service';
import {UnitService} from '../../../structure/services/unit.service';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {debounceTime, delay, finalize, Subject, takeUntil} from 'rxjs';
import {AllEmployeesRequest} from '../../models/all-employees-request.model';
import {Employee} from '../../models/employee.model';
import {Unit} from '../../../structure/models/unit.model';
import {CommonModule} from '@angular/common';
import {DepartmentService} from '../../../structure/services/department.service';
import {Department} from '../../../structure/models/department.model';
import {BsModalService, ModalOptions} from 'ngx-bootstrap/modal';
import {EditEmployeeModalComponent} from '../../components/edit-employee-modal/edit-employee-modal.component';

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

  private readonly departmentService = inject(DepartmentService);
  private readonly employeeService = inject(EmployeesService);
  private readonly unitService = inject(UnitService);
  private readonly modalService = inject(BsModalService);

  searchSubject$: Subject<string> = new Subject<string>();
  fb = inject(FormBuilder);
  form: FormGroup = new FormGroup({});

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
    this.getEmployees();

    this.initializeForm();

    this.setupSearchSubscription();

    this.getUnits();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  private getEmployees() {
    this.isLoading.set(true);

    this.employeeService.getAllEmployees(this.request())
      .pipe(
        delay(500),
        finalize(() => {
          this.isLoading.set(false);
        })
      )
      .subscribe(val => {
        this.employees.set(val);
      });
  }

  private initializeForm() {
    this.form = this.fb.group({
      searchPattern: [undefined],
      unitId: [null],
      departmentId: [null]
    });
  }

  onSearchChange(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    this.searchSubject$.next(inputElement.value);
  }

  onUnitChange(event: Event) {
    if (!this.request)
      return;

    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (unitId == 'null') {
      this.request.update(req => ({
        ...req,
        unitId: undefined,
        departmentId: undefined
      }));
      this.departments.set([]);

      this.initializeForm();
    } else {
      this.request.update(req => ({
        ...req,
        unitId: Number(unitId)
      }));

      this.getDepartmentsByUnitId(Number(unitId));
    }

    this.getEmployees();
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

    this.getEmployees();
  }

  private getUnits() {
    this.unitService.getUnits()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(units => {
        this.units.set(units);
      });
  }

  private getDepartmentsByUnitId(unitId: number) {
    this.departmentService.getDepartmentsByUnitId(unitId)
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(departments => {
        this.departments.set(departments);
      });
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
}
