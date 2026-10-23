import {Component, inject, OnDestroy, signal} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {finalize, Subject, takeUntil} from 'rxjs';
import {AccountService} from '../../services/account.service';
import {CreateUserRequest} from '../../models/create-user-request.model';
import {EmployeeGender} from '../../../../features/organization/employees/enums/employee-gender.enum';
import {ThemeToggleComponent} from '../../../../shared/components/theme-toggle/theme-toggle.component';

import {PrimeTemplate} from 'primeng/api';
import {CardModule} from 'primeng/card';
import {KeyFilter} from 'primeng/keyfilter';
import {FloatLabel} from 'primeng/floatlabel';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {Password} from 'primeng/password';
import {Select} from 'primeng/select';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';

const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[a-z]).{6,}$/;

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ThemeToggleComponent,
    PrimeTemplate,
    CardModule,
    KeyFilter,
    FloatLabel,
    IconField,
    InputIcon,
    InputText,
    Password,
    Select,
    Button,
    Message
  ],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss'
})
export class RegisterPageComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  private accountService = inject(AccountService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly phoneKeyFilter = /[\d+]/;

  readonly genderOptions = [
    {label: 'Чоловік', value: EmployeeGender.male},
    {label: 'Жінка', value: EmployeeGender.female}
  ];

  form: FormGroup = this.fb.group(
    {
      surname: ['', [Validators.required]],
      name: ['', [Validators.required]],
      patronymic: ['', [Validators.required]],
      gender: [null, [Validators.required]],
      phoneNumber: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6), Validators.pattern(PASSWORD_PATTERN)]],
      confirmPassword: ['', [Validators.required]]
    },
    {validators: RegisterPageComponent.passwordMatchValidator}
  );

  isLoading = signal<boolean>(false);

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  get passwordsMismatch(): boolean {
    const confirm = this.form.get('confirmPassword');
    return !!this.form.errors?.['passwordsNotMatch'] && !!confirm && (confirm.dirty || confirm.touched);
  }

  register(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: CreateUserRequest = {
      name: value.name,
      surname: value.surname,
      patronymic: value.patronymic,
      email: value.email,
      phoneNumber: value.phoneNumber,
      gender: value.gender,
      password: value.password,
      confirmPassword: value.confirmPassword
    };

    this.isLoading.set(true);
    this.accountService.register(request)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => this.router.navigateByUrl('/home')
      });
  }

  static passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return !confirmPassword || password === confirmPassword ? null : {passwordsNotMatch: true};
  }
}
