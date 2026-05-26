import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AccountService} from '../../services/account.service';
import {Employee} from '../../../../features/organization/employees/models/employee.model';
import {EmployeeGender} from '../../../../features/organization/employees/enums/employee-gender.enum';
import {EditAccountRequest} from '../../models/edit-account-request.model';
import {Subject, takeUntil} from 'rxjs';
import {CommonModule} from '@angular/common';
import moment from "moment";
import {ErrorService} from "../../../../shared/services/error.service";
import {ErrorType} from "../../../../shared/enums/error-type.enum";
import {
  ProfilePhotoConfirmationModalComponent
} from "../../components/profile-photo-confirmation-modal/profile-photo-confirmation-modal.component";
import {BsModalService} from "ngx-bootstrap/modal";
import {EmployeeRole} from "../../models/employee-role.model";
import {EmployeeRolesService} from "../../services/employee-roles.service";

@Component({
  selector: 'app-edit-account-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
  ],
  templateUrl: './edit-account-page.component.html',
  styleUrl: './edit-account-page.component.scss'
})
export class EditAccountPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private modalService = inject(BsModalService);
  private employeeRolesService = inject(EmployeeRolesService);
  private errorService = inject(ErrorService);
  private accountService = inject(AccountService);
  private fb = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    patronymic: ['', [Validators.required, Validators.maxLength(100)]],
    surname: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s-()]+$/)]],
    dateOfBirth: [null],
    gender: [EmployeeGender.none, [Validators.required]]
  });

  errorMessage = signal<string | null>(null);
  employee = signal<Employee | null>(null);
  profilePhotoUrl = signal<string>('/assets/images/profile.png');
  employeeRoles = signal<EmployeeRole[]>([]);

  formattedDateOfBirth = computed(() => {
    const dateOfBirth = this.employee()?.dateOfBirth;
    return dateOfBirth ? this.formatDate(dateOfBirth) : null;
  });

  ngOnInit(): void {
    this.loadCurrentEmployee();
  }

  loadCurrentEmployee(): void {
    this.accountService.getCurrentUser()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (currentUser) => {
          if (currentUser && currentUser.employee) {
            this.employee.set(currentUser.employee);
            this.getUserPhoto(currentUser.employee.id);
            this.updateFormWithEmployeeData();
            this.getEmployeeRolesByEmployeeId(currentUser.employee.id);
          }
        }
      });
  }

  updateFormWithEmployeeData(): void {
    const emp = this.employee();

    if (!emp) return;

    this.form.patchValue({
      name: emp.name,
      patronymic: emp.patronymic,
      surname: emp.surname,
      email: emp.email,
      phoneNumber: emp.phoneNumber,
      dateOfBirth: this.formattedDateOfBirth(),
      gender: emp.gender
    });
  }

  private getEmployeeRolesByEmployeeId(employeeId: number) {
    this.employeeRolesService.getEmployeeRolesByEmployeeId(employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (employeeRoles) => this.employeeRoles.set(employeeRoles)
      });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Будь ласка, заповніть всі обов\'язкові поля коректно');
      return;
    }

    this.errorMessage.set(null);

    const updatedRequest: EditAccountRequest = {
      id: this.employee()?.id || 0,
      name: this.form.value.name,
      patronymic: this.form.value.patronymic,
      surname: this.form.value.surname,
      email: this.form.value.email,
      dateOfBirth: this.form.value.dateOfBirth,
      gender: this.form.value.gender,
      phoneNumber: this.form.value.phoneNumber
    };

    this.accountService.updateAccount(updatedRequest)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.errorService.handleError('Зміни успішно збережено', ErrorType.info)
        }
      });
  }

  formatDate(date?: Date): string | null {
    if (!date)
      return null;

    return moment(date).format('YYYY-MM-DD');
  }

  triggerFileInput(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        if (!file.type.startsWith('image/')) {
          alert('Будь ласка, виберіть файл зображення');
          return;
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          alert('Розмір файлу не повинен перевищувати 5MB');
          return;
        }

        this.openPhotoPreview(file);
      }
    };

    input.click();
  }

  private openPhotoPreview(file: File): void {
    const modalRef = this.modalService.show(ProfilePhotoConfirmationModalComponent, {
      class: 'modal-lg'
    });

    const component = modalRef.content as ProfilePhotoConfirmationModalComponent;
    if (component) {
      component.setImage(file);
      component.onClose.subscribe((selectedFile: File) => {
        this.uploadPhoto(selectedFile);
      });
    }
  }

  private uploadPhoto(file: File): void {
    const formData = new FormData();
    formData.append('File', file);
    formData.append('EmployeeId', this.employee()?.id?.toString() ?? '0');

    this.accountService.uploadProfilePhoto(formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const employeeId = this.employee()?.id;
          if (employeeId) {
            this.getUserPhoto(employeeId);
          }
        }
      });
  }

  getUserPhoto(employeeId: number) {
    this.accountService.getProfilePhoto(employeeId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.body) {
            const blob = response.body;
            const url = URL.createObjectURL(blob);
            this.profilePhotoUrl.set(url);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
