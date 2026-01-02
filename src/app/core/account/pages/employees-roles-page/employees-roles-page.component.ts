import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {GoBackComponent} from '../../../../shared/components/go-back/go-back.component';
import {Employee} from '../../../../features/organization/employees/models/employee.model';
import {EmployeesService} from '../../../../features/organization/employees/services/employees.service';
import {AllEmployeesRequest} from '../../../../features/organization/employees/models/all-employees-request.model';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {CommonModule} from '@angular/common';
import {Unit} from '../../../../features/organization/structure/models/unit.model';
import {UnitService} from '../../../../features/organization/structure/services/unit.service';
import {BsModalService, ModalOptions} from 'ngx-bootstrap/modal';
import {
  CreateEmployeeRoleModalComponent
} from '../../components/create-employee-role-modal/create-employee-role-modal.component';
import {
  CreateEmployeeRoleUnitModalComponent
} from '../../components/create-employee-role-unit-modal/create-employee-role-unit-modal.component';
import {
  CreateEmployeeRoleUnitDepartmentModalComponent
} from '../../components/create-employee-role-unit-department-modal/create-employee-role-unit-department-modal.component';
import {EmployeeRole} from '../../models/employee-role.model';
import {EmployeeRolesService} from '../../services/employee-roles.service';
import {
  DeleteConfirmationModalComponent
} from "../../../../shared/components/delete-confirmation-modal/delete-confirmation-modal.component";
import {delay, finalize, Subject, takeUntil} from "rxjs";
import {EmployeeRoleUnit} from "../../models/employee-role-unit.model";
import {EmployeeRoleUnitsService} from "../../services/employee-role-units.service";
import {EmployeeRoleUnitDepartmentsService} from "../../services/employee-role-unit-departments.service";
import {EmployeeRoleUnitDepartment} from "../../models/employee-role-unit-department.model";

@Component({
  selector: 'app-employees-roles-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    GoBackComponent,
  ],
  templateUrl: './employees-roles-page.component.html',
  styleUrl: './employees-roles-page.component.scss'
})
export class EmployeesRolesPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private fb = inject(FormBuilder);
  private unitService = inject(UnitService);
  private employeeService = inject(EmployeesService);
  private employeeRolesService = inject(EmployeeRolesService);
  private employeeRoleUnitsService = inject(EmployeeRoleUnitsService);
  private employeeRoleUnitDepartmentsService = inject(EmployeeRoleUnitDepartmentsService);
  modalService = inject(BsModalService);

  form: FormGroup = this.fb.group({
    searchPattern: [undefined],
    unitId: [null],
    departmentId: [null]
  });

  private request = signal<AllEmployeesRequest>({
    searchPattern: undefined,
    departmentId: undefined,
    unitId: undefined,
  });

  employees = signal<Employee[]>([]);
  units = signal<Unit[]>([]);
  employeeRoles = signal<EmployeeRole[]>([]);
  employeeRoleUnits = signal<EmployeeRoleUnit[]>([]);
  employeeRoleUnitDepartments = signal<EmployeeRoleUnitDepartment[]>([]);
  isLoading = signal(false);

  unitId?: number;
  employeeId?: number;
  employeeRoleId?: number;
  employeeRoleUnitId?: number;
  showCreateEmployeeRoleButton: boolean = false;
  showCreateEmployeeRoleUnitButton: boolean = false;
  showCreateEmployeeRoleUnitDepartmentButton: boolean = false;

  ngOnInit(): void {
    this.getEmployees();

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
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(val => {
        this.employees.set(val);
      });
  }

  private getUnits() {
    this.unitService.getUnits()
      .pipe(takeUntil(this.destroy$))
      .subscribe(units => {
        this.units.set(units);
      });
  }

  onUnitChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const unitIdValue = selectElement.value;

    if (unitIdValue === 'null') {
      this.request.update(req => ({
        ...req,
        departmentId: undefined
      }));
      this.form.patchValue({
        unitId: null,
        departmentId: null
      });

      this.request.update(req => ({
        ...req,
        unitId: undefined
      }));
    }
    else {
      this.request.update(req => ({
        ...req,
        unitId: Number(unitIdValue)
      }));
    }

    this.getEmployees();
  }

  selectEmployee(employeeId: number) {
    this.employeeId = employeeId;
    this.employeeRoleId = undefined;

    this.showCreateEmployeeRoleButton = true;
    this.showCreateEmployeeRoleUnitButton = false;
    this.showCreateEmployeeRoleUnitDepartmentButton = false;

    this.employeeRoleUnits.set([]);
    this.employeeRoleUnitDepartments.set([]);

    this.getEmployeeRolesByEmployeeId(employeeId);
  }

  openCreateEmployeeRoleModal() {
    const initialState: ModalOptions = {
      class: 'modal-dialog-centered',
      initialState: {
        employeeId: this.employeeId,
      }
    }

    const ref = this.modalService.show(
      CreateEmployeeRoleModalComponent,
      initialState);

    ref.onHidden?.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.getEmployeeRolesByEmployeeId(this.employeeId!)
      });
  }

  private getEmployeeRolesByEmployeeId(employeeId: number) {
    this.employeeRolesService.getEmployeeRolesByEmployeeId(employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (employeeRoles) => this.employeeRoles.set(employeeRoles)
      });
  }

  openDeleteEmployeeRoleConfirmationModal(employeeRole: EmployeeRole) {
    this.modalService.show(
      DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          itemName: employeeRole.role.name,
          entityName: `роль`,
          onConfirm: () => this.deleteEmployeeRole(employeeRole.id)
        }
      });
  }

  private deleteEmployeeRole(employeeRoleId: number) {
    this.employeeRolesService.delete(employeeRoleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.getEmployeeRolesByEmployeeId(this.employeeId!);

          this.employeeRoleUnits.set([]);
          this.employeeRoleUnitDepartments.set([]);

          this.showCreateEmployeeRoleUnitButton = false;
          this.showCreateEmployeeRoleUnitDepartmentButton = false;
        }
      });
  }

  selectEmployeeRole(employeeRoleId: number) {
    this.employeeRoleId = employeeRoleId;
    this.employeeRoleUnitId = undefined;
    this.showCreateEmployeeRoleUnitButton = true;
    this.showCreateEmployeeRoleUnitDepartmentButton = false;

    this.employeeRoleUnitDepartments.set([]);

    this.getEmployeeRoleUnitsByEmployeeRoleId(employeeRoleId);
  }

  getEmployeeRoleUnitsByEmployeeRoleId(employeeRoleId: number) {
    this.employeeRoleUnitsService.getByEmployeeRoleId(employeeRoleId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (employeeRoleUnits) => this.employeeRoleUnits.set(employeeRoleUnits)
      });
  }

  openCreateEmployeeRoleUnitModal() {
    const initialState: ModalOptions = {
      class: 'modal-dialog-centered',
      initialState: {
        employeeRoleId: this.employeeRoleId,
      }
    }

    const ref = this.modalService.show(
      CreateEmployeeRoleUnitModalComponent,
      initialState);

    ref.onHidden?.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.getEmployeeRoleUnitsByEmployeeRoleId(this.employeeRoleId!)
      });
  }

  openDeleteEmployeeRoleUnitConfirmationModal(employeeRoleUnit: EmployeeRoleUnit) {
    this.modalService.show(
      DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          itemName: employeeRoleUnit.unit.name,
          entityName: `регіон`,
          onConfirm: () => this.deleteEmployeeRoleUnit(employeeRoleUnit.id)
        }
      });
  }

  deleteEmployeeRoleUnit(employeeRoleUnitId: number) {
    this.employeeRoleUnitsService.deleteById(employeeRoleUnitId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.employeeRoleUnitDepartments.set([]);

          this.getEmployeeRoleUnitsByEmployeeRoleId(this.employeeRoleId!);
        }
      });
  }

  selectEmployeeRoleUnit(employeeRoleUnitId: number) {
    this.employeeRoleUnitId = employeeRoleUnitId;
    this.showCreateEmployeeRoleUnitDepartmentButton = true;

    this.employeeRoleUnitDepartments.set([]);
    this.getEmployeeRoleUnitDepartmentsByEmployeeRoleUnitId(employeeRoleUnitId);
  }

  getEmployeeRoleUnitDepartmentsByEmployeeRoleUnitId(employeeRoleUnitId: number) {
    this.employeeRoleUnitDepartmentsService.getByEmployeeRoleUnitId(employeeRoleUnitId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (employeeRoleUnitDepartments) => this.employeeRoleUnitDepartments.set(employeeRoleUnitDepartments)
      });
  }

  openCreateEmployeeRoleUnitDepartmentModal() {
    const initialState: ModalOptions = {
      class: 'modal-dialog-centered',
      initialState: {
        employeeRoleUnitId: this.employeeRoleUnitId,
      }
    }

    const ref = this.modalService.show(
      CreateEmployeeRoleUnitDepartmentModalComponent,
      initialState);

    ref.onHidden?.pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.getEmployeeRoleUnitDepartmentsByEmployeeRoleUnitId(this.employeeRoleUnitId!)
      });
  }

  openDeleteEmployeeRoleUnitDepartmentConfirmationModal(employeeRoleUnitDepartment: EmployeeRoleUnitDepartment) {
    this.modalService.show(
      DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          itemName: employeeRoleUnitDepartment.department.name,
          entityName: `департамент`,
          onConfirm: () => this.deleteEmployeeRoleUnitDepartment(employeeRoleUnitDepartment.id)
        }
      });
  }

  deleteEmployeeRoleUnitDepartment(employeeRoleUnitDepartmentId: number) {
    this.employeeRoleUnitDepartmentsService.delete(employeeRoleUnitDepartmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.getEmployeeRoleUnitDepartmentsByEmployeeRoleUnitId(this.employeeRoleUnitId!);
        }
      });
  }
}
