import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {EmployeesService} from '../../services/employees.service';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import {EditEmployeeRequest} from '../../models/edit-employee-request';
import {EmployeeGender} from '../../enums/employee-gender.enum';
import {Employee} from '../../models/employee.model';
import moment from 'moment';
import {Subject, takeUntil, throwError} from 'rxjs';
import {Unit} from '../../../structure/models/unit.model';
import {Department} from '../../../structure/models/department.model';
import {UnitService} from '../../../structure/services/unit.service';
import {DepartmentService} from '../../../structure/services/department.service';
import {CommonModule} from '@angular/common';
import {Position} from '../../../structure/models/position.model';
import {PositionService} from '../../../structure/services/position.service';

@Component({
  selector: 'app-edit-employee-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './edit-employee-modal.component.html',
  styleUrl: './edit-employee-modal.component.scss'
})
export class EditEmployeeModalComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private readonly employeesService = inject(EmployeesService);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly positionService = inject(PositionService);
  bsModalRef = inject(BsModalRef);

  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group({
    surname: ['', [Validators.required]],
    name: ['', [Validators.required]],
    patronymic: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: [{value: '', disabled: true}],
    unitId: [0],
    positionId: [0],
    departmentId: [0],
    dateOfBirth: [null],
    gender: [null, [Validators.required]]
  });

  employeeId?: number;
  employee?: Employee;
  units = signal<Unit[]>([]);
  departments = signal<Department[]>([]);
  positions = signal<Position[]>([]);

  defaultDropdownDepartment: Department = {
    id: 0,
    name: 'Оберіть департамент',
    unit: undefined,
    unitId: undefined
  };

  defaultDropdownUnit: Unit = {
    id: 0,
    name: 'Оберіть регіон',
    code: '',
    description: '',
    fullName: ''
  };

  defaultDropdownPosition: Position = {
    id: 0,
    name: 'Оберіть посаду',
    description: '',
    hourlyRate: 0
  };

  request = signal<EditEmployeeRequest>({
    id: 0,
    name: '',
    surname: '',
    patronymic: '',
    email: '',
    gender: EmployeeGender.none,
    departmentId: undefined,
    positionId: undefined,
    dateOfBirth: undefined
  });

  ngOnInit(): void {
    this.getEmployeeById();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getEmployeeById() {
    if (this.employeeId) {
      this.employeesService.getEmployeeById(this.employeeId)
        .pipe(takeUntil(this.destroy$))
        .subscribe(employee => {
          if (employee) {
            this.getUnits();

            this.getPositions();

            if (employee.department) {
              this.getDepartmentsByUnitId(employee.department?.unitId!);
            } else {
              this.departments.set([this.defaultDropdownDepartment]);
            }

            this.updateFormWithEmployeeData(employee);
          }
        })
    }
  }

  updateFormWithEmployeeData(employee: Employee) {
    this.form.patchValue({
      surname: employee.surname,
      name: employee.name,
      patronymic: employee.patronymic,
      email: employee.email,
      phoneNumber: employee.phoneNumber,
      unitId: employee.department?.unitId! ?? 0,
      positionId: employee.positionId! ?? 0,
      departmentId: employee.departmentId! ?? 0,
      dateOfBirth: this.formatDate(employee.dateOfBirth),
      gender: employee.gender
    })
  }

  formatDate(date?: Date) {
    if (!date)
      return null;

    return moment(date).format('YYYY-MM-DD');
  }

  save() {
    if (!this.employeeId)
      return;

    this.request.update(value => ({
      ...value,
      id: this.employeeId!,
      name: this.form.value.name,
      patronymic: this.form.value.patronymic,
      surname: this.form.value.surname,
      email: this.form.value.email,
      dateOfBirth: this.form.value.dateOfBirth,
      gender: this.form.value.gender,
      departmentId: Number(this.form.value.departmentId) === 0 ? null : this.form.value.departmentId,
      positionId: Number(this.form.value.positionId) === 0 ? null : this.form.value.positionId
    }));

    this.employeesService.updateEmployee(this.request())
      .subscribe({
        next: (employee) => {
          this.bsModalRef.hide();
        },
        error: error => throwError(() => new Error(error))
      });
  }

  getUnits() {
    this.unitService.getUnits()
      .pipe(takeUntil(this.destroy$))
      .subscribe(units => {
        this.units.set([this.defaultDropdownUnit!, ...units]);
        this.departments.set([this.defaultDropdownDepartment]);
      });
  }

  onUnitChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const unitId = selectElement.value;

    if (Number(unitId) == 0) {
      this.request.update(value => ({
        ...value,
        departmentId: undefined
      }));

      this.departments.set([this.defaultDropdownDepartment]);
    } else {
      this.getDepartmentsByUnitId(Number(unitId));
    }

    this.form.get('departmentId')?.setValue(this.defaultDropdownDepartment.id);
  }

  getDepartmentsByUnitId(unitId: number) {
    this.departmentService.getDepartmentsByUnitId(unitId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(departments => {
        this.departments.set([this.defaultDropdownDepartment, ...departments]);
      });
  }

  getPositions() {
    this.positionService.getPositions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(positions => {
        if (positions)
          this.positions.set([this.defaultDropdownPosition, ...positions]);
        else
          this.positions.set([this.defaultDropdownPosition]);
      })
  }
}
