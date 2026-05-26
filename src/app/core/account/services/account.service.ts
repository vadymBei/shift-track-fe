import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { Token } from '../models/token.model';
import { CurrentUser } from '../models/current-user.model';
import { CreateUserRequest } from '../models/create-user-request.model';
import { Employee } from '../../../features/organization/employees/models/employee.model';
import { EditAccountRequest } from '../models/edit-account-request.model';
import { ChangePasswordRequest } from '../models/change-password-request.model';

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private httpClient = inject(HttpClient);
  private router = inject(Router);

  token = signal<Token | null>(null);
  currentUser = signal<CurrentUser | null>(null);

  private refreshTokenRequest$?: Observable<Token>;

  constructor() {
    const storedToken = localStorage.getItem('token');

    if (storedToken) {
      this.token.set(JSON.parse(storedToken));
    }

    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        this.currentUser.set(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing user data from localStorage:', e);
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
      } catch (e) {
        console.error('Error parsing user data from localStorage:', e);
      }
    }

    return this.httpClient.get<CurrentUser>('system/auth/account/current-user')
      .pipe(
        tap(user => this.setCurrentUser(user))
      );
  }

  login(model: any) {
    return this.httpClient.post<Token>('system/auth/tokens/generate', model)
      .pipe(
        tap(token => {
          if (token.tokenType && token.accessToken && token.refreshToken) {
            this.setToken(token);
            this.loadCurrentUser();
          }
        })
      );
  }

  register(request: CreateUserRequest) {
    return this.httpClient.post<Token>('system/auth/account/register', request)
      .pipe(
        tap(token => {
          if (token.tokenType && token.accessToken && token.refreshToken) {
            this.setToken(token);
            this.loadCurrentUser();
          }
        })
      );
  }

  setToken(token: Token) {
    localStorage.setItem('token', JSON.stringify(token));
    this.token.set(token);
  }

  refreshTokenOnce(): Observable<Token> {
    const refreshToken = this.token()?.refreshToken;

    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('Refresh token is missing'));
    }

    if (this.refreshTokenRequest$) {
      return this.refreshTokenRequest$;
    }

    this.refreshTokenRequest$ = this.httpClient.post<Token>(
      'system/auth/tokens/refresh',
      { refreshToken }
    ).pipe(
      tap(token => this.setToken(token)),
      shareReplay(1),
      finalize(() => {
        this.refreshTokenRequest$ = undefined;
      }),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );

    return this.refreshTokenRequest$;
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
