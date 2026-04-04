import {HttpErrorResponse, HttpInterceptorFn} from "@angular/common/http";
import {inject} from "@angular/core";
import {catchError, throwError} from "rxjs";
import {BackendError} from "../models/errors/backend-error";
import {ErrorService} from "../services/error.service";

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorService = inject(ErrorService);

  return next(req).pipe(
    catchError((httpError: HttpErrorResponse) => {
      const backendError = httpError.error as BackendError;
      const isRefreshRequest = req.url.includes('system/auth/tokens/refresh');

      if (httpError.status === 401 && isRefreshRequest) {
        return throwError(() => httpError);
      }

      if (backendError) {
        switch (httpError.status) {
          case 400: // Bad Request
            if (backendError.ValidationErrors) {
              errorService.handleValidationError(backendError.ValidationErrors);
            } else {
              errorService.handleBackendError(backendError);
            }
            break;

          case 422:
            if (backendError.ValidationErrors) {
              errorService.handleValidationError(backendError.ValidationErrors);
            } else {
              errorService.handleBackendError(backendError);
            }
            break;

          case 403: // Forbidden
            errorService.handleBackendError(backendError);
            break;

          case 404: // Not Found
            errorService.handleError('Ресурс не знайдено');
            break;

          case 500: // Server Error
            errorService.handleError('Помилка сервера. Спробуйте пізніше');
            break;

          default:
            errorService.handleError(backendError.ErrorMessage || 'Виникла непередбачена помилка');
        }
      } else {
        if (!navigator.onLine) {
          errorService.handleError('Відсутнє з\'єднання з інтернетом');
        } else {
          errorService.handleError('Виникла непередбачена помилка');
        }
      }

      return throwError(() => httpError);
    })
  );
};
