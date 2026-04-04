import {HttpInterceptorFn, HttpRequest} from '@angular/common/http';
import {inject} from '@angular/core';
import {catchError, switchMap, throwError} from 'rxjs';
import {AccountService} from "../../core/account/services/account.service";

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const accountService = inject(AccountService);
  const token = accountService.token();

  if (req.url.includes('system/auth/tokens/refresh')) {
    return next(req);
  }

  if (!token?.accessToken) {
    return next(req);
  }

  return next(addToken(req, token.accessToken)).pipe(
    catchError(error => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      return accountService.refreshTokenOnce().pipe(
        switchMap(() => {
          const latestToken = accountService.token()?.accessToken;

          if (!latestToken) {
            return throwError(() => new Error('Access token is missing after refresh'));
          }

          return next(addToken(req, latestToken));
        }),
        catchError(refreshError => {
          return throwError(() => refreshError);
        })
      );
    })
  );
};

const addToken = (req: HttpRequest<any>, accessToken: string) => {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`
    }
  });
};
