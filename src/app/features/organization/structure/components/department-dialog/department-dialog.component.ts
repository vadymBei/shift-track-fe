import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {catchError, finalize, of, Subject, takeUntil} from 'rxjs';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';
import {InputText} from 'primeng/inputtext';
import {Select} from 'primeng/select';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {NotificationService} from '../../../../../shared/services/notification.service';
import {DepartmentService} from '../../services/department.service';
import {UnitService} from '../../services/unit.service';
import {Department} from '../../models/department.model';
import {Unit} from '../../models/unit.model';

export interface DepartmentDialogData {
  department?: Department;
  unitId?: number;
}

@Component({
  selector: 'app-department-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, InputText, Select, Button, Message],
  templateUrl: './department-dialog.component.html'
})
export class DepartmentDialogComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly ref = inject(DynamicDialogRef);
  private readonly departmentService = inject(DepartmentService);
  private readonly unitService = inject(UnitService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  private readonly data = inject<DynamicDialogConfig<DepartmentDialogData>>(DynamicDialogConfig).data;
  readonly department = this.data?.department;
  readonly units = signal<Unit[]>([]);
  readonly isSaving = signal(false);

  readonly form = this.fb.group({
    name: [this.department?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    unitId: [{value: this.department?.unitId ?? this.data?.unitId ?? null, disabled: !!this.department}, [Validators.required]]
  });

  ngOnInit(): void {
    this.unitService.getUnits()
      .pipe(catchError(() => of([] as Unit[])), takeUntil(this.destroy$))
      .subscribe(units => this.units.set(units));
  }

  isInvalid(name: 'name' | 'unitId'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const {name, unitId} = this.form.getRawValue();
    const request$ = this.department
      ? this.departmentService.updateDepartment({id: this.department.id, name: name!.trim()})
      : this.departmentService.createDepartment({name: name!.trim(), unitId: unitId!});

    this.isSaving.set(true);
    request$
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success(this.department ? 'Департамент оновлено' : 'Департамент додано');
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
