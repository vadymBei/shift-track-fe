import {Component, computed, inject, OnDestroy, OnInit, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {finalize, Subject, takeUntil} from 'rxjs';
import {toApiDate, toDate} from '../../../../shared/utils/date.utils';

import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {DatePicker} from 'primeng/datepicker';
import {Select} from 'primeng/select';
import {Message} from 'primeng/message';
import {Tag} from 'primeng/tag';
import {Avatar} from 'primeng/avatar';
import {Dialog} from 'primeng/dialog';
import {Skeleton} from 'primeng/skeleton';
import {Divider} from 'primeng/divider';
import {Tooltip} from 'primeng/tooltip';

import {AccountService} from '../../services/account.service';
import {EmployeeRolesService} from '../../services/employee-roles.service';
import {EmployeeRole} from '../../models/employee-role.model';
import {EditAccountRequest} from '../../models/edit-account-request.model';
import {Employee} from '../../../../features/organization/employees/models/employee.model';
import {EmployeeGender} from '../../../../features/organization/employees/enums/employee-gender.enum';
import {NotificationService} from '../../../../shared/services/notification.service';
import {personInitials} from '../../../../shared/utils/text.utils';
import {EmployeePhotosService} from '../../../../shared/services/employee-photos.service';
import {PersonAvatarDirective} from '../../../../shared/directives/person-avatar.directive';
import {ConfirmService} from '../../../../shared/services/confirm.service';
import {squarePhoto} from '../../../../shared/utils/image.utils';

/** Of the chosen file: it's scaled down before the upload. */
const MAX_SOURCE_SIZE = 20 * 1024 * 1024;

@Component({
  selector: 'app-edit-account-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    Button,
    InputText,
    IconField,
    InputIcon,
    DatePicker,
    Select,
    Message,
    Tag,
    Avatar,
    Dialog,
    Skeleton,
    Divider,
    Tooltip,
    PersonAvatarDirective
  ],
  templateUrl: './edit-account-page.component.html',
  styleUrl: './edit-account-page.component.scss'
})
export class EditAccountPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly accountService = inject(AccountService);
  private readonly employeeRolesService = inject(EmployeeRolesService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly genderOptions = [
    {label: 'Не вказано', value: EmployeeGender.none},
    {label: 'Чоловік', value: EmployeeGender.male},
    {label: 'Жінка', value: EmployeeGender.female}
  ];

  readonly maxBirthDate = new Date();

  readonly form = this.fb.group({
    surname: ['', [Validators.required, Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    patronymic: ['', [Validators.required, Validators.maxLength(100)]],
    dateOfBirth: this.fb.control<Date | null>(null),
    gender: [EmployeeGender.none as EmployeeGender, [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]+$/)]]
  });

  readonly employee = signal<Employee | null>(null);
  readonly employeeRoles = signal<EmployeeRole[]>([]);
  private readonly photos = inject(EmployeePhotosService);
  private readonly confirmService = inject(ConfirmService);
  readonly hasPhoto = computed(() => !!this.photos.photo(this.employee()?.id)());
  readonly isSaving = signal(false);
  readonly isLoading = signal(true);

  readonly photoDialogVisible = signal(false);
  readonly photoPreviewUrl = signal<string | null>(null);
  readonly isUploading = signal(false);
  private photoFile: Blob | null = null;

  readonly initials = computed(() => personInitials(this.employee()));

  readonly workInfo = computed(() => {
    const e = this.employee();
    return [
      {icon: 'pi pi-id-card', label: 'Посада', value: e?.position?.name},
      {icon: 'pi pi-building', label: 'Департамент', value: e?.department?.name},
      {icon: 'pi pi-map-marker', label: 'Регіон', value: e?.department?.unit?.description || e?.department?.unit?.name}
    ].filter(item => !!item.value);
  });

  ngOnInit(): void {
    this.accountService.getCurrentUser()
      .pipe(finalize(() => this.isLoading.set(false)), takeUntil(this.destroy$))
      .subscribe(user => {
        const employee = user?.employee;
        if (!employee) {
          return;
        }
        this.employee.set(employee);
        this.fillForm(employee);
        this.employeeRolesService.getEmployeeRolesByEmployeeId(employee.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe(roles => this.employeeRoles.set(roles));
      });
  }

  private fillForm(employee: Employee): void {
    this.form.reset({
      surname: employee.surname,
      name: employee.name,
      patronymic: employee.patronymic,
      dateOfBirth: employee.dateOfBirth ? toDate(employee.dateOfBirth) : null,
      gender: employee.gender ?? EmployeeGender.none,
      email: employee.email,
      phoneNumber: employee.phoneNumber
    });
  }

  isInvalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  save(): void {
    const employee = this.employee();
    if (this.form.invalid || !employee) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: EditAccountRequest = {
      id: employee.id,
      surname: value.surname ?? '',
      name: value.name ?? '',
      patronymic: value.patronymic ?? '',
      email: value.email ?? '',
      phoneNumber: value.phoneNumber ?? '',
      gender: value.gender ?? EmployeeGender.none,
      dateOfBirth: value.dateOfBirth ? toApiDate(value.dateOfBirth) as unknown as Date : undefined
    };

    this.isSaving.set(true);
    this.accountService.updateAccount(request)
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.employee.update(e => e ? {...e, ...request, dateOfBirth: value.dateOfBirth ?? undefined} : e);
        this.form.markAsPristine();
        this.notifications.success('Зміни збережено');
      });
  }

  resetForm(): void {
    const employee = this.employee();
    if (employee) {
      this.fillForm(employee);
    }
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.notifications.warn('Оберіть файл зображення (JPG, PNG тощо)');
      return;
    }
    if (file.size > MAX_SOURCE_SIZE) {
      this.notifications.warn('Розмір фото не повинен перевищувати 20 МБ');
      return;
    }

    // Cropped to a square and scaled down here: the preview shows exactly what is saved.
    let photo: Blob;
    try {
      photo = await squarePhoto(file);
    } catch {
      this.notifications.warn('Не вдалося відкрити зображення. Спробуйте JPG або PNG');
      return;
    }

    this.photoFile = photo;
    this.revokePreview();
    this.photoPreviewUrl.set(URL.createObjectURL(photo));
    this.photoDialogVisible.set(true);
  }

  cancelPhoto(): void {
    this.photoDialogVisible.set(false);
    this.photoFile = null;
    this.revokePreview();
  }

  uploadPhoto(): void {
    const employee = this.employee();
    if (!this.photoFile || !employee) {
      return;
    }

    this.isUploading.set(true);
    this.accountService.uploadProfilePhoto(this.photoFile)
      .pipe(finalize(() => this.isUploading.set(false)), takeUntil(this.destroy$))
      .subscribe(photo => {
        this.notifications.success('Фото оновлено');
        this.cancelPhoto();
        this.photos.changed(employee.id, photo.version);
      });
  }

  confirmRemovePhoto(): void {
    const employee = this.employee();
    if (!employee) {
      return;
    }

    this.confirmService.confirm({
      header: 'Видалити фото?',
      message: 'Замість фото колеги бачитимуть ваші ініціали.',
      acceptLabel: 'Видалити',
      acceptSeverity: 'danger',
      icon: 'pi pi-trash',
      onConfirm: () => {
        this.isUploading.set(true);
        this.accountService.removeProfilePhoto()
          .pipe(finalize(() => this.isUploading.set(false)), takeUntil(this.destroy$))
          .subscribe(() => {
            this.notifications.success('Фото видалено');
            this.photos.changed(employee.id, null);
          });
      }
    });
  }

  private revokePreview(): void {
    const url = this.photoPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.photoPreviewUrl.set(null);
    }
  }

  ngOnDestroy(): void {
    this.revokePreview();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
