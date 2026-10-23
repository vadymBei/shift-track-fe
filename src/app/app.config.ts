import {ApplicationConfig, ErrorHandler, LOCALE_ID, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {tokenInterceptor} from './shared/interceptors/tocken.interceptor';
import {errorInterceptor} from './shared/interceptors/error.interceptor';
import {apiInterceptor} from './shared/interceptors/api.interceptor';
import {provideAnimations} from "@angular/platform-browser/animations";
import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import {providePrimeNG} from 'primeng/config';
import {ConfirmationService, MessageService} from 'primeng/api';
import {AppPreset} from './shared/constants/primeng-preset';
import {primeNgUk} from './shared/constants/primeng-uk';

registerLocaleData(localeUk);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes),
    provideHttpClient(withInterceptors([
      apiInterceptor,
      errorInterceptor,
      tokenInterceptor])),
    {provide: ErrorHandler},
    {provide: LOCALE_ID, useValue: 'uk'},
    provideAnimations(),
    MessageService,
    ConfirmationService,
    providePrimeNG({
      theme: {
        preset: AppPreset,
        options: {
          darkModeSelector: '.app-dark',
          cssLayer: false
        }
      },
      translation: primeNgUk,
      overlayOptions: {appendTo: 'body'}
    })
  ]
};
