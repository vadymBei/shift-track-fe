import {Component, computed, inject, OnDestroy, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {finalize, startWith, Subject, takeUntil} from 'rxjs';

import {Password} from 'primeng/password';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';

import {AccountService} from '../../services/account.service';
import {ChangePasswordRequest} from '../../models/change-password-request.model';
import {NotificationService} from '../../../../shared/services/notification.service';

const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[a-z]).{6,}$/;

@Component({
  selector: 'app-change-password-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, Password, Button, Message],
  templateUrl: './change-password-page.component.html',
  styleUrl: './change-password-page.component.scss'
})
export class ChangePasswordPageComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  private readonly accountService = inject(AccountService);
  private readonly notifications = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group(
    {
      oldPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(6), Validators.pattern(PASSWORD_PATTERN)]],
      confirmPassword: ['', [Validators.required]]
    },
    {validators: ChangePasswordPageComponent.passwordsValidator}
  );

  readonly isSaving = signal(false);

  private readonly value = toSignal(this.form.valueChanges.pipe(startWith(this.form.value)), {initialValue: this.form.value});

  readonly rules = computed(() => {
    const {oldPassword = '', newPassword = '', confirmPassword = ''} = this.value();
    const next = newPassword ?? '';
    return [
      {label: 'Щонайменше 6 символів', ok: next.length >= 6},
      {label: 'Мала латинська літера (a–z)', ok: /[a-z]/.test(next)},
      {label: 'Принаймні одна цифра', ok: /\d/.test(next)},
      {label: 'Відрізняється від поточного', ok: !!next && next !== oldPassword},
      {label: 'Паролі збігаються', ok: !!next && next === confirmPassword}
    ];
  });

  isInvalid(name: 'oldPassword' | 'newPassword' | 'confirmPassword'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  get mismatch(): boolean {
    const confirm = this.form.controls.confirmPassword;
    return !!this.form.errors?.['passwordsNotMatch'] && (confirm.touched || confirm.dirty) && !!confirm.value;
  }

  get sameAsOld(): boolean {
    const next = this.form.controls.newPassword;
    return !!this.form.errors?.['sameAsOld'] && (next.touched || next.dirty);
  }

  save(): void {
    const employeeId = this.accountService.currentUser()?.employee?.id;
    if (this.form.invalid || !employeeId) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: ChangePasswordRequest = {
      employeeId,
      oldPassword: value.oldPassword ?? '',
      newPassword: value.newPassword ?? '',
      confirmPassword: value.confirmPassword ?? ''
    };

    this.isSaving.set(true);
    this.accountService.changePassword(request)
      .pipe(finalize(() => this.isSaving.set(false)), takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications.success('Пароль змінено');
        this.form.reset();
      });
  }

  static passwordsValidator(group: AbstractControl): ValidationErrors | null {
    const oldPassword = group.get('oldPassword')?.value;
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    const errors: ValidationErrors = {};

    if (confirmPassword && newPassword !== confirmPassword) {
      errors['passwordsNotMatch'] = true;
    }
    if (newPassword && oldPassword && newPassword === oldPassword) {
      errors['sameAsOld'] = true;
    }
    return Object.keys(errors).length ? errors : null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
