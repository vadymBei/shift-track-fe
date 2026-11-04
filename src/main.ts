import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { configureDates } from './app/shared/utils/date.utils';

configureDates();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
