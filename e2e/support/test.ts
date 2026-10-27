import {expect, test as base} from '@playwright/test';
import {department, TestUser, unit, vacationBalance} from './data';
import {MockApi} from './mock-api';
import {NotificationsHub} from './notifications-hub';

interface Fixtures {
  /** The backend, answered by the test. */
  api: MockApi;
  /** The SignalR notifications hub. */
  hub: NotificationsHub;
  /** Opens the app signed in as the user (token and profile as after a login). */
  signInAs: (user: TestUser) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  api: [async ({page}, use) => {
    const api = new MockApi(page);

    // Defaults for the requests every page makes; tests override what they check.
    api
      .on('GET', 'communication/notifications/unread/count', {count: 0})
      .on('GET', 'communication/notifications', [])
      .on('GET', 'booking/approvals/pending/count', {vacations: 0, businessTrips: 0})
      .on('GET', /^booking\/vacations\/balance\//, vacationBalance())
      .on('GET', 'organization/structure/units/by-roles', [unit])
      .on('GET', /^organization\/structure\/departments\/by-roles/, [department])
      .on('GET', 'system/auth/account/photo', {}, 404);

    await api.install();
    await use(api);
  }, {auto: true}],

  hub: [async ({page}, use) => {
    const hub = new NotificationsHub(page);
    await hub.install();
    await use(hub);
  }, {auto: true}],

  signInAs: async ({page, api}, use) => {
    await use(async (user: TestUser) => {
      api.on('GET', 'system/auth/account/current-user', user);

      await page.addInitScript(currentUser => {
        localStorage.setItem('st-theme', 'light');
        localStorage.setItem('token', JSON.stringify({tokenType: 'Bearer', accessToken: 'e2e', refreshToken: 'e2e'}));
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }, user);
    });
  }
});

export {expect};
