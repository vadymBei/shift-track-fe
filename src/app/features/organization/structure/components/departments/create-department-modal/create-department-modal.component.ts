import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {CreateDepartmentRequest} from '../../../models/create-demartment-request.model';
import {UnitService} from '../../../services/unit.service';
import {Subject, takeUntil} from 'rxjs';
import {Unit} from '../../../models/unit.model';
import {CommonModule} from '@angular/common';
import {DepartmentService} from '../../../services/department.service';

@Component({
  selector: 'app-create-department-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './create-department-modal.component.html',
  styleUrl: './create-department-modal.component.scss'
})
export class CreateDepartmentModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly unitService = inject(UnitService);
  private readonly departmentService = inject(DepartmentService);

  bsModalRef = inject(BsModalRef);

  // можна передати через initialState
  unitId?: number;

  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(100)
      ]
    ],
    unitId: [
      null,
      [
        Validators.required
      ]
    ]
  });

  units = signal<Unit[]>([]);
  request = signal<CreateDepartmentRequest>({
    name: '',
    unitId: 0
  });

  ngOnInit(): void {
    this.getUnits();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getUnits() {
    this.unitService.getUnits()
      .pipe(takeUntil(this.destroy$))
      .subscribe(units => {
        this.units.set(units);

        if (this.unitId) {
          this.form.patchValue({
            unitId: this.unitId
          });
        }
      });
  }

  createDepartment() {
    if (!this.request)
      return;

    this.request.update(value => ({
      ...value,
      name: this.form.value.name,
      unitId: Number(this.form.value.unitId)
    }));

    this.departmentService.createDepartment(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (department) => {
          this.bsModalRef.hide();
        },
        error: error => {
          console.error('creating department error', error);
        }
      });
  }
}
