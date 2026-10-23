import {HttpClient, HttpContext, HttpErrorResponse} from '@angular/common/http';
import {SKIP_ERROR_NOTIFICATION} from '../../../shared/interceptors/error.interceptor';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { Token } from '../models/token.model';
import { CurrentUser } from '../models/current-user.model';
import { CreateUserRequest } from '../models/create-user-request.model';
import { Employee } from '../../../features/organization/employees/models/employee.model';
import { EditAccountRequest } from '../models/edit-account-request.model';
import { ChangePasswordRequest } from '../models/change-password-request.model';
import { NotificationService } from '../../../shared/services/notification.service';

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private httpClient = inject(HttpClient);
  private router = inject(Router);
  private notifications = inject(NotificationService);

  token = signal<Token | null>(null);
  currentUser = signal<CurrentUser | null>(null);

  private refreshInFlight$: Observable<Token> | null = null;

  constructor() {
    const storedToken = localStorage.getItem('token');

    if (storedToken) {
      try {
        this.token.set(JSON.parse(storedToken));
      } catch {
        localStorage.removeItem('token');
      }
    }

    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        this.currentUser.set(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
  }

  private loadCurrentUser() {
    this.httpClient.get<CurrentUser>('system/auth/account/current-user')
      .subscribe(user => this.setCurrentUser(user));
  }

  private setCurrentUser(user: CurrentUser): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUser.set(user);
  }

  getCurrentUser(): Observable<CurrentUser | null> {
    const storedUser = localStorage.getItem('currentUser');

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        this.currentUser.set(user);
        return of(user);
      } catch {
        localStorage.removeItem('currentUser');
      }
    }

    return this.httpClient.get<CurrentUser>('system/auth/account/current-user')
      .pipe(
        tap(user => this.setCurrentUser(user))
      );
  }

  login(model: any) {
    return this.httpClient.post<Token>('system/auth/tokens/generate', model)
      .pipe(switchMap(token => this.applyTokenAndLoadUser(token)));
  }

  register(request: CreateUserRequest) {
    return this.httpClient.post<Token>('system/auth/account/register', request)
      .pipe(switchMap(token => this.applyTokenAndLoadUser(token)));
  }

  private applyTokenAndLoadUser(token: Token): Observable<Token> {
    if (!(token.tokenType && token.accessToken && token.refreshToken)) {
      return of(token);
    }
    this.setToken(token);
    return this.httpClient.get<CurrentUser>('system/auth/account/current-user').pipe(
      tap(user => this.setCurrentUser(user)),
      map(() => token),
      catchError(() => of(token))
    );
  }

  setToken(token: Token) {
    localStorage.setItem('token', JSON.stringify(token));
    this.token.set(token);
  }

  refreshTokenOnce(): Observable<Token> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    const refreshToken = this.token()?.refreshToken;
    if (!refreshToken) {
      this.endSession();
      return throwError(() => new Error('Refresh token is missing'));
    }

    this.refreshInFlight$ = this.httpClient.post<Token>(
      'system/auth/tokens/refresh',
      {refreshToken},
      {context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true)}
    ).pipe(
      tap(token => this.setToken(token)),
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && [400, 401, 403].includes(error.status)) {
          this.endSession();
        }
        return throwError(() => error);
      }),
      finalize(() => this.refreshInFlight$ = null),
      shareReplay({bufferSize: 1, refCount: false})
    );

    return this.refreshInFlight$;
  }

  private endSession(): void {
    if (!this.token()) {
      return;
    }
    this.logout();
    this.notifications.warn('Сесія завершилась. Увійдіть знову, щоб продовжити.', 'Потрібен вхід');
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.token.set(null);
    this.currentUser.set(null);
    this.router.navigate(['/account/login']);
  }

  updateAccount(request: EditAccountRequest) {
    return this.httpClient.put<Employee>('system/auth/account', request)
      .pipe(
        tap(() => this.loadCurrentUser())
      );
  }

  changePassword(request: ChangePasswordRequest) {
    return this.httpClient.post<Token>('system/auth/account/password/change', request)
      .pipe(
        tap(token => {
          if (token.tokenType && token.accessToken && token.refreshToken) {
            this.setToken(token);
            this.loadCurrentUser();
          }
        })
      );
  }

  getProfilePhoto(employeeId: number) {
    return this.httpClient.get(`system/auth/account/photo`, {
      context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      params: {
        EmployeeId: employeeId
      },
      responseType: 'blob',
      observe: 'response'
    });
  }

  uploadProfilePhoto(formData: FormData) {
    return this.httpClient.post(
      'system/auth/account/upload-photo',
      formData,
      {
        reportProgress: true,
        responseType: 'blob',
        observe: 'response'
      }
    );
  }
}
