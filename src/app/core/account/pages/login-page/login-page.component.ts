import {Component, inject, OnDestroy, signal} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {finalize, Subject, takeUntil} from 'rxjs';
import {AccountService} from '../../services/account.service';

import {PrimeTemplate} from 'primeng/api';
import {CardModule} from 'primeng/card';
import {FloatLabel} from 'primeng/floatlabel';
import {IconField} from 'primeng/iconfield';
import {InputIcon} from 'primeng/inputicon';
import {InputText} from 'primeng/inputtext';
import {KeyFilter} from 'primeng/keyfilter';
import {Password} from 'primeng/password';
import {Button} from 'primeng/button';
import {Message} from 'primeng/message';
import {Divider} from 'primeng/divider';
import {Tag} from 'primeng/tag';
import {TableModule} from 'primeng/table';
import {Avatar} from 'primeng/avatar';
import {ThemeToggleComponent} from '../../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PrimeTemplate,
    CardModule,
    FloatLabel,
    IconField,
    InputIcon,
    InputText,
    KeyFilter,
    Password,
    Button,
    Message,
    Divider,
    Tag,
    TableModule,
    Avatar,
    ThemeToggleComponent
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss'
})
export class LoginPageComponent implements OnDestroy {
  private destroy$ = new Subject<void>();

  private accountService = inject(AccountService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  readonly features = [
    'Перегляд розкладу',
    'Облік відпрацьованих годин',
    'Табель для бухгалтерії'
  ];

  readonly todayShifts = [
    {time: '08:00 - 16:00', name: 'Іван'},
    {time: '10:00 - 19:00', name: 'Марія'}
  ];

  readonly phoneKeyFilter = /[\d+]/;

  public form: FormGroup = this.fb.group({
    login: ['', [Validators.required]],
    password: [
      '',
      [
        Validators.required,
        Validators.minLength(6),
        Validators.pattern(/^(?=.*\d)(?=.*[a-z]).{6,}$/)
      ]
    ]
  });

  isLoading = signal<boolean>(false);

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  login() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.accountService.login(this.form.value)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => this.router.navigateByUrl('/home')
      });
  }
}
