import {Component, inject, OnDestroy, OnInit,  signal} from '@angular/core';
import { GoBackComponent } from '../../../../../../shared/components/go-back/go-back.component';
import { DepartmentService } from '../../../services/department.service';
import { BsModalService } from 'ngx-bootstrap/modal';
import {delay, finalize, Subject, takeUntil} from 'rxjs';
import { Department } from '../../../models/department.model';
import { CommonModule } from '@angular/common';
import { GroupedDepartmentsByUnit } from '../../../models/grouped-departments-by-unit.model';
import { EditDepartmentModalComponent } from '../../../components/departments/edit-department-modal/edit-department-modal.component';
import { CreateDepartmentModalComponent } from '../../../components/departments/create-department-modal/create-department-modal.component';
import { DeleteConfirmationModalComponent } from '../../../../../../shared/components/delete-confirmation-modal/delete-confirmation-modal.component';

@Component({
  selector: 'app-departments-page',
  standalone: true,
  imports: [
    CommonModule,
    GoBackComponent
  ],
  templateUrl: './departments-page.component.html',
  styleUrl: './departments-page.component.scss'
})
export class DepartmentsPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly departmentService = inject(DepartmentService);
  private readonly modalService = inject(BsModalService);

  groupedDepartments = signal<GroupedDepartmentsByUnit[]>([]);
  isLoading = signal(false);

  ngOnInit(): void {
    this.getDepartments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getDepartments() {
    this.isLoading.set(true);

    this.departmentService.getGroupedDepartmentsGroupedByUnits()
      .pipe(
        delay(500),
        finalize(() => {
          this.isLoading.set(false);
        }),
        takeUntil(this.destroy$))
      .subscribe(departments => {
        this.groupedDepartments.set(departments);
      })
  }

  openCreateDepartmentModal() {
    const ref = this.modalService.show(
      CreateDepartmentModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
        }
      }
    );

    ref.onHidden?.subscribe({
      next: () => this.getDepartments()
    })
  }

  openEditDepartmentModal(department: Department) {
    const ref = this.modalService.show(
      EditDepartmentModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          department: department,
        }
      });

    ref.onHidden?.subscribe({
      next: () => this.getDepartments()
    })
  }

  openDeleteConfirmation(department: Department): void {
    this.modalService.show(
      DeleteConfirmationModalComponent,
      {
        class: 'modal-dialog-centered',
        initialState: {
          itemName: department.name,
          entityName: 'департамент',
          onConfirm: () => this.deleteDepartment(department.id)
        }
      });
  }

  deleteDepartment(departmentId: number) {
    this.departmentService.deleteDepartment(departmentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.getDepartments();
        }
      })
  }
}
