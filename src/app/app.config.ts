import {ApplicationConfig, ErrorHandler, importProvidersFrom, LOCALE_ID, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {tokenInterceptor} from './shared/interceptors/tocken.interceptor';
import {errorInterceptor} from './shared/interceptors/error.interceptor';
import {apiInterceptor} from './shared/interceptors/api.interceptor';
import {ModalModule} from 'ngx-bootstrap/modal';
import {provideAnimations} from "@angular/platform-browser/animations";
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';

registerLocaleData(localeUk);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({eventCoalescing: true}),
    provideRouter(routes),
    provideHttpClient(withInterceptors([
      apiInterceptor,
      tokenInterceptor,
      errorInterceptor])),
    importProvidersFrom([
      ModalModule.forRoot(),
      TooltipModule.forRoot()
    ]),
    {provide: ErrorHandler},
    {provide: LOCALE_ID, useValue: 'uk'},
    provideAnimations()
  ]
};
