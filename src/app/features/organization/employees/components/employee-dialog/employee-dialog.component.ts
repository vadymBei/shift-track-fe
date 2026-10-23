import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {catchError, finalize, of, Subject, takeUntil} from 'rxjs';
import moment from 'moment';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {PrimeTemplate} from 'primeng/api';
import {InputText} from 'primeng/inputtext';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {DatePicker} from 'primeng/datepicker';
import {Select} from 'primeng/select';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {Avatar} from 'primeng/avatar';
import {Skeleton} from 'primeng/skeleton';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {EmployeesService} from '../../services/employees.service';
import {UnitService} from '../../../structure/services/unit.service';
import {DepartmentService} from '../../../structure/services/department.service';
import {PositionService} from '../../../structure/services/position.service';
import {Employee} from '../../models/employee.model';
import {EditEmployeeRequest} from '../../models/edit-employee-request';
import {EmployeeGender} from '../../enums/employee-gender.enum';
import {Unit} from '../../../structure/models/unit.model';
import {Department} from '../../../structure/models/department.model';
import {Position} from '../../../structure/models/position.model';
import {personInitials} from '../../../../../shared/utils/text.utils';

export interface EmployeeDialogData {
  employeeId: number;
}

@Component({
  selector: 'app-employee-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, PrimeTemplate, InputText, IconField, InputIcon, DatePicker, Select,
    Button, Message, Avatar, Skeleton
  ],
  templateUrl: './employee-dialog.component.html',
  styleUrl: './employee-dialog.component.scss'
})
export class EmployeeDialogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly employeesService = inject(EmployeesService);
  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);
  private readonly positionService = inject(PositionService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  private readonly employeeId = inject<DynamicDialogConfig<EmployeeDialogData>>(DynamicDialogConfig).data!.employeeId;

  readonly genderOptions = [
    {label: 'Не вказано', value: EmployeeGender.none},
    {label: 'Чоловік', value: EmployeeGender.male},
    {label: 'Жінка', value: EmployeeGender.female}
  ];
  readonly maxBirthDate = new Date();

  readonly employee = signal<Employee | null>(null);
  readonly units = signal<Unit[]>([]);
  readonly departments = signal<Department[]>([]);
  readonly positions = signal<Position[]>([]);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);

  readonly initials = computed(() => personInitials(this.employee()));

  readonly form = this.fb.group({
    surname: ['', [Validators.required, Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    patronymic: ['', [Validators.required, Validators.maxLength(100)]],
    dateOfBirth: this.fb.control<Date | null>(null),
    gender: [EmployeeGender.none as EmployeeGender, [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: [{value: '', disabled: true}],
    unitId: this.fb.control<number | null>(null),
    departmentId: this.fb.control<number | null>(null),
    positionId: this.fb.control<number | null>(null)
  });

  ngOnInit(): void {
    this.unitService.getUnits()
      .pipe(catchError(() => of([] as Unit[])), takeUntil(this.destroy$))
      .subscribe(units => this.units.set(units));

    this.positionService.getPositions()
      .pipe(catchError(() => of([] as Position[])), takeUntil(this.destroy$))
      .subscribe(positions => this.positions.set(positions));

    this.employeesService.getEmployeeById(this.employeeId)
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(employee => {
        this.employee.set(employee);
        const unitId = employee.department?.unitId ?? employee.department?.unit?.id ?? null;
        this.form.reset({
          surname: employee.surname,
          name: employee.name,
          patronymic: employee.patronymic,
          dateOfBirth: employee.dateOfBirth ? moment(employee.dateOfBirth).toDate() : null,
          gender: employee.gender ?? EmployeeGender.none,
          email: employee.email,
          phoneNumber: employee.phoneNumber,
          unitId,
          departmentId: employee.departmentId ?? null,
          positionId: employee.positionId ?? null
        });
        if (unitId) {
          this.loadDepartments(unitId);
        }
      });
  }

  onUnitChange(unitId: number | null): void {
    this.form.patchValue({departmentId: null});
    this.departments.set([]);
    if (unitId) {
      this.loadDepartments(unitId);
    }
  }

  private loadDepartments(unitId: number): void {
    this.departmentService.getDepartmentsByUnitId(unitId)
      .pipe(catchError(() => of([] as Department[])), takeUntil(this.destroy$))
      .subscribe(departments => this.departments.set(departments));
  }

  isInvalid(name: 'surname' | 'name' | 'patronymic' | 'email'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: EditEmployeeRequest = {
      id: this.employeeId,
      surname: value.surname!.trim(),
      name: value.name!.trim(),
      patronymic: value.patronymic!.trim(),
      email: value.email!.trim(),
      gender: value.gender ?? EmployeeGender.none,
      dateOfBirth: value.dateOfBirth ? moment(value.dateOfBirth).format('YYYY-MM-DD') as unknown as Date : undefined,
      departmentId: value.departmentId ?? undefined,
      positionId: value.positionId ?? undefined
    };

    this.isSaving.set(true);
    this.employeesService.updateEmployee(request)
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success('Дані працівника збережено');
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
