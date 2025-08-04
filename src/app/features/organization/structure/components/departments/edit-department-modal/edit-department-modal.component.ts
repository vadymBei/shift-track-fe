import {Component, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {DepartmentService} from '../../../services/department.service';
import {BsModalRef} from 'ngx-bootstrap/modal';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {EditDepartmentRequest} from '../../../models/edit-department-request.model';
import {Department} from '../../../models/department.model';
import {CommonModule} from '@angular/common';
import {Subject, takeUntil} from "rxjs";

@Component({
  selector: 'app-edit-department-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './edit-department-modal.component.html',
  styleUrl: './edit-department-modal.component.scss'
})
export class EditDepartmentModalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly departmentService = inject(DepartmentService);

  bsModalRef = inject(BsModalRef);

  fb = inject(FormBuilder);
  form: FormGroup = this.fb.group({
    name: [
      '',
      [
        Validators.required,
        Validators.maxLength(100)
      ]
    ]
  });

  request = signal<EditDepartmentRequest>(
    {
      id: 0,
      name: ''
    });

  department?: Department;

  ngOnInit(): void {
    this.getDepartmentById();
  }

  getDepartmentById() {
    this.departmentService.getDepartmentById(this.department!.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(department => {
        this.updateFormWithDepartmentData(department);
      });
  }

  updateFormWithDepartmentData(department: Department) {
    this.form.patchValue({
      name: department.name,
    });
  }

  save() {
    if (!this.request)
      return;

    this.request.update(value => ({
      ...value,
      id: this.department!.id,
      name: this.form.value.name
    }));

    this.departmentService.updateDepartment(this.request())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (departmen) => {
          this.bsModalRef.hide();
        },
        error: error => {
          console.error('updating department error', error);
        }
      })
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
