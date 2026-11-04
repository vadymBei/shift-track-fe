import {Page, Request} from '@playwright/test';
import {expect, test} from './support/test';
import {directChat, employee, users} from './support/data';
import {MockApi, RawBody} from './support/mock-api';

const me = users.departmentDirector;
const olena = users.employee.employee;
const taras = employee(13, 'Бондар', 'Тарас');

// 6×4: the profile page crops it to a square before the upload.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAYAAAAECAIAAAAiZtkUAAAAEUlEQVR4nGM4YWODhhjIFQIAgageAUsowTkAAAAASUVORK5CYII=', 'base64');

/** The employees with a photo, answered like the API: only the ids asked about. */
function withPhotos(api: MockApi, versions: Record<number, string>) {
  api
    .on('GET', 'organization/employees/photos', (request: Request) => new URL(request.url()).searchParams.getAll('ids')
      .map(Number)
      .filter(id => versions[id])
      .map(employeeId => ({employeeId, version: versions[employeeId]})))
    .on('GET', /^organization\/employees\/\d+\/photo\?v=/, new RawBody(png, 'image/png'));
}

const menuAvatar = (page: Page) => page.getByRole('button', {name: 'Меню користувача'}).locator('.p-avatar');

test.describe('Employee photos', () => {
  test.beforeEach(async ({signInAs}) => {
    await signInAs(me);
  });

  test('lists show photos, and initials for those without one', async ({page, api}) => {
    withPhotos(api, {[olena.id]: 'v1', [me.employee.id]: 'm1'});
    api.on('GET', 'organization/employees', [olena, taras]);

    await page.goto('/administration/employees');

    const row = (name: string) => page.locator('tbody tr').filter({hasText: name}).locator('.p-avatar');
    await expect(row('Коваль Олена').locator('img')).toBeVisible();
    await expect(row('Бондар Тарас')).toHaveText('БТ');
    await expect(row('Бондар Тарас').locator('img')).toHaveCount(0);
    await expect(menuAvatar(page).locator('img')).toBeVisible();

    // One request about everyone on the page, and only the photos that exist are downloaded, by version.
    const asked = api.requestsTo('GET', 'organization/employees/photos')
      .flatMap(x => new URLSearchParams(x.path.split('?')[1]).getAll('ids'));
    expect([...asked].sort()).toEqual([String(me.employee.id), String(olena.id), String(taras.id)].sort());
    expect(api.requestsTo('GET', /^organization\/employees\/\d+\/photo/).map(x => x.path).sort())
      .toEqual([`organization/employees/${me.employee.id}/photo?v=m1`, `organization/employees/${olena.id}/photo?v=v1`]);
  });

  test('the messenger shows the photo of the colleague', async ({page, api}) => {
    withPhotos(api, {[olena.id]: 'v1'});
    api.on('GET', 'communication/messenger/conversations', [directChat(me, olena)]);

    await page.goto('/messages');

    const item = page.getByRole('navigation', {name: 'Чати'}).getByRole('link', {name: /Коваль Олена/});
    await expect(item.locator('img.photo')).toBeVisible();
  });

  test('my photo is cropped, uploaded and shown everywhere, and can be removed', async ({page, api}) => {
    let uploaded: Buffer | null = null;
    withPhotos(api, {});
    api
      .on('POST', 'system/auth/account/photo', (request: Request) => {
        uploaded = request.postDataBuffer();
        return {employeeId: me.employee.id, version: 'new'};
      })
      .on('DELETE', 'system/auth/account/photo', {});

    await page.goto('/administration/profile/edit');
    await expect(menuAvatar(page)).toHaveText('ВБ');

    await page.locator('#photoInput').setInputFiles({name: 'me.png', mimeType: 'image/png', buffer: png});
    const dialog = page.getByRole('dialog', {name: 'Нове фото профілю'});
    const preview = dialog.getByRole('img', {name: 'Попередній перегляд фото'});
    await expect(preview).toBeVisible();
    // The centre square of 6×4.
    expect(await preview.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([4, 4]);

    await dialog.getByRole('button', {name: 'Зберегти фото'}).click();

    await expect(menuAvatar(page).locator('img')).toBeVisible();
    await expect(page.locator('.profile-avatar img')).toBeVisible();
    expect(uploaded!.toString('latin1')).toContain('Content-Type: image/jpeg');
    expect(api.requestsTo('GET', /^organization\/employees\/\d+\/photo/).map(x => x.path))
      .toContain(`organization/employees/${me.employee.id}/photo?v=new`);

    await page.getByRole('button', {name: 'Видалити фото'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Видалити'}).click();

    await expect.poll(() => api.requestsTo('DELETE', 'system/auth/account/photo').length).toBe(1);
    await expect(menuAvatar(page)).toHaveText('ВБ');
    await expect(menuAvatar(page).locator('img')).toHaveCount(0);
  });
});
