import {inject, Injectable, signal} from '@angular/core';
import {Subject} from 'rxjs';
import {BackendError} from '../models/errors/backend-error';
import {ErrorNotification} from "../models/errors/error-notification";
import {ErrorTranslations} from "../constants/error-translations";
import {ErrorType} from "../enums/error-type.enum";
import {NotificationService} from "./notification.service";

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  private errorSubject = new Subject<ErrorNotification>();
  public errors$ = this.errorSubject.asObservable();

  public latestError = signal<ErrorNotification | null>(null);

  private validationErrorsSubject = new Subject<Record<string, string[]>>();
  public validationErrors$ = this.validationErrorsSubject.asObservable();

  private notifications = inject(NotificationService);

  handleError(message: string, type: ErrorType = ErrorType.error): void {
    const notification: ErrorNotification = {
      message,
      type,
      timestamp: new Date()
    };

    this.errorSubject.next(notification);
    this.showToast(message, type);
    this.latestError.set(notification);
  }

  handleBackendError(error: BackendError): void {
    let translatedMessage = error.ErrorMessage;

    if (error.ErrorType && ErrorTranslations[error.ErrorType]) {
      const errorTypeTranslation = ErrorTranslations[error.ErrorType];

      translatedMessage = `${errorTypeTranslation}`;
    }

    this.handleError(translatedMessage);
  }

  handleValidationError(validationErrors: Record<string, string[]>): void {
    this.validationErrorsSubject.next(validationErrors);

    this.handleError('Перевірте коректність введених даних', ErrorType.warning);
  }

  private showToast(message: string, type: ErrorType): void {
    switch (type) {
      case ErrorType.warning:
        this.notifications.warn(message);
        break;
      case ErrorType.info:
        this.notifications.info(message);
        break;
      default:
        this.notifications.error(message);
    }
  }

  clearError(): void {
    this.latestError.set(null);
  }
}
