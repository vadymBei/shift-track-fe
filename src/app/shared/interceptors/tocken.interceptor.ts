import {HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, map, Observable, of, switchMap, throwError} from 'rxjs';
import {AccountService} from '../../core/account/services/account.service';
import {isAuthEndpoint} from '../constants/auth-endpoints';

export const BYPASS_TOKEN = new HttpContextToken<boolean>(() => false);

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(BYPASS_TOKEN) || isAuthEndpoint(req.url)) {
    return next(req);
  }

  const accountService = inject(AccountService);
  const sentToken = accountService.token()?.accessToken;

  if (!sentToken) {
    return next(req);
  }

  return next(withToken(req, sentToken)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return freshAccessToken(accountService, sentToken).pipe(
        catchError(refreshError => throwError(() => accountService.token() ? refreshError : error)),
        switchMap(accessToken => next(withToken(req, accessToken)))
      );
    })
  );
};

function freshAccessToken(accountService: AccountService, sentToken: string): Observable<string> {
  const current = accountService.token()?.accessToken;
  if (current && current !== sentToken) {
    return of(current);
  }
  return accountService.refreshTokenOnce().pipe(map(token => token.accessToken));
}

function withToken(req: HttpRequest<unknown>, accessToken: string): HttpRequest<unknown> {
  return req.clone({setHeaders: {Authorization: `Bearer ${accessToken}`}});
}
