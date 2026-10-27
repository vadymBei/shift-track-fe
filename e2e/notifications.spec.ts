import {Page} from '@playwright/test';
import {expect, test} from './support/test';
import {notification, permissions, users, vacation} from './support/data';
import {NotificationsHub} from './support/notifications-hub';

/** The sidebar and the header both have a bell; only one of them is visible at a time. */
const bell = (page: Page) => page.getByRole('button', {name: /^Сповіщення/}).filter({visible: true}).first();

/**
 * Opens the page and waits until the unread count is loaded and the hub is connected,
 * otherwise a late count response would overwrite what a pushed notification changed.
 */
async function openConnected(page: Page, hub: NotificationsHub, url: string) {
  const countLoaded = page.waitForResponse(response => response.url().includes('/notifications/unread/count'));

  await page.goto(url);
  await countLoaded;
  await hub.waitForConnection();
}

test.describe('Notifications', () => {
  test.beforeEach(async ({signInAs}) => {
    await signInAs(users.departmentDirector);
  });

  test('the bell shows the unread count', async ({page, api}) => {
    api.on('GET', 'communication/notifications/unread/count', {count: 3});

    await page.goto('/home');

    await expect(bell(page)).toHaveAccessibleName('Сповіщення, непрочитаних: 3');
  });

  test('a pushed notification is counted, shown as a toast and refreshes pending counters', async ({page, api, hub}) => {
    await openConnected(page, hub, '/home');
    await expect(bell(page)).toHaveAccessibleName('Сповіщення');
    const countRequests = api.requestsTo('GET', 'booking/approvals/pending/count').length;

    await hub.notificationReceived(notification({title: 'Нова заява на відпустку'}));

    await expect(bell(page)).toHaveAccessibleName('Сповіщення, непрочитаних: 1');
    await expect(page.locator('.p-toast')).toContainText('Нова заява на відпустку');
    await expect.poll(() => api.requestsTo('GET', 'booking/approvals/pending/count').length)
      .toBeGreaterThan(countRequests);
  });

  test('a change elsewhere reloads the unread count', async ({page, api, hub}) => {
    api.on('GET', 'communication/notifications/unread/count', {count: 2});
    await openConnected(page, hub, '/home');
    await expect(bell(page)).toHaveAccessibleName('Сповіщення, непрочитаних: 2');

    api.on('GET', 'communication/notifications/unread/count', {count: 0});
    await hub.notificationsChanged();

    await expect(bell(page)).toHaveAccessibleName('Сповіщення');
  });

  test('opening a notification marks it as read and opens the vacation', async ({page, api}) => {
    const pending = vacation({id: 42, permissions: permissions({canView: true, canApprove: true})});

    api
      .on('GET', 'communication/notifications/unread/count', {count: 1})
      .on('GET', 'communication/notifications', [notification({id: 7, entityId: 42, title: 'Нова заява на відпустку'})])
      .on('GET', 'booking/vacations', [pending])
      .on('GET', 'booking/vacations/42', pending);

    await page.goto('/home');
    await bell(page).click();

    const panel = page.getByRole('dialog', {name: 'Сповіщення'});
    await panel.getByText('Нова заява на відпустку').click();

    await expect.poll(() => api.requestsTo('PUT', 'communication/notifications/read/7').length).toBe(1);
    await expect(page).toHaveURL(/\/vacations/);
    await expect(page.getByRole('dialog').filter({hasText: 'Коваль Олена'})).toBeVisible();
    await expect(bell(page)).toHaveAccessibleName('Сповіщення');
  });

  test('all notifications can be marked as read', async ({page, api}) => {
    api
      .on('GET', 'communication/notifications/unread/count', {count: 2})
      .on('GET', 'communication/notifications', [
        notification({id: 1, title: 'Нова заява на відпустку'}),
        notification({id: 2, title: 'Відпустку погоджено', type: 'VacationFinallyApproved'})
      ]);

    await page.goto('/home');
    await bell(page).click();
    await page.getByRole('dialog', {name: 'Сповіщення'}).getByRole('button', {name: 'Позначити всі прочитаними'}).click();

    await expect.poll(() => api.requestsTo('PUT', 'communication/notifications/read-all').length).toBe(1);
    await expect(bell(page)).toHaveAccessibleName('Сповіщення');
  });
});
