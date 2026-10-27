import {expect, test} from './support/test';
import {employee, permissions, users, vacation} from './support/data';

test.describe('Vacations', () => {
  const colleague = employee(12, 'Шевчук', 'Ірина');
  const other = employee(13, 'Бондар', 'Тарас');

  test('row actions follow the permissions returned by the API', async ({page, api, signInAs}) => {
    await signInAs(users.departmentDirector);
    api.on('GET', 'booking/vacations', [
      vacation({id: 1, employee: users.employee.employee, permissions: permissions({canView: true, canApprove: true, canReject: true})}),
      vacation({id: 2, employee: colleague, status: 'ApprovedByUnitDirector', permissions: permissions({canView: true, canDownload: true})}),
      vacation({id: 3, employee: other, status: 'None', permissions: permissions({canView: true, canEdit: true, canDelete: true})})
    ]);

    await page.goto('/vacations');

    const row = (name: string) => page.locator('tbody tr').filter({hasText: name});

    await expect(row('Коваль Олена').getByRole('button', {name: 'Відкрити заявку'})).toBeVisible();
    await expect(row('Коваль Олена').getByRole('button', {name: 'Видалити заявку'})).toHaveCount(0);
    await expect(row('Коваль Олена').getByRole('button', {name: 'Завантажити заяву'})).toHaveCount(0);

    await expect(row('Шевчук Ірина').getByRole('button', {name: 'Завантажити заяву'})).toBeVisible();
    await expect(row('Шевчук Ірина').getByRole('button', {name: 'Видалити заявку'})).toHaveCount(0);

    await expect(row('Бондар Тарас').getByRole('button', {name: 'Видалити заявку'})).toBeVisible();
  });

  test('a vacation without permissions has no actions', async ({page, api, signInAs}) => {
    await signInAs(users.employee);
    api.on('GET', 'booking/vacations', [vacation({id: 1, employee: colleague, permissions: permissions()})]);

    await page.goto('/vacations');

    const row = page.locator('tbody tr').filter({hasText: 'Шевчук Ірина'});
    await expect(row).toBeVisible();
    await expect(row.getByRole('button')).toHaveCount(0);
  });

  test('own draft is submitted for approval', async ({page, api, signInAs}) => {
    const draft = vacation({
      id: 7,
      status: 'None',
      employee: users.employee.employee,
      authorId: users.employee.employee.id,
      permissions: permissions({canView: true, canEdit: true, canApprove: true, canDelete: true, approveSubmitsForApproval: true})
    });

    await signInAs(users.employee);
    api
      .on('GET', 'booking/vacations', [draft])
      .on('GET', 'booking/vacations/7', draft)
      .on('PUT', 'booking/vacations/approve/7', {...draft, status: 'PendingApproval'});

    await page.goto('/vacations');
    await page.locator('tbody tr').filter({hasText: 'Коваль Олена'}).getByRole('button', {name: 'Відкрити заявку'}).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', {name: 'Погодити'})).toHaveCount(0);
    await dialog.getByRole('button', {name: 'Подати на погодження'}).click();

    await expect.poll(() => api.requestsTo('PUT', 'booking/vacations/approve/7').length).toBe(1);
  });

  test('approving a vacation refreshes the counters in the menu', async ({page, api, signInAs}) => {
    const pending = vacation({id: 8, permissions: permissions({canView: true, canApprove: true, canReject: true})});

    await signInAs(users.departmentDirector);
    api
      .on('GET', 'booking/approvals/pending/count', {vacations: 1, businessTrips: 0})
      .on('GET', 'booking/vacations', [pending])
      .on('GET', 'booking/vacations/8', pending)
      .on('PUT', 'booking/vacations/approve/8', {...pending, status: 'ApprovedByDepartmentDirector'});

    await page.goto('/vacations');
    await expect(page.getByLabel('1 чекають рішення')).toBeVisible();

    await page.locator('tbody tr').filter({hasText: 'Коваль Олена'}).getByRole('button', {name: 'Відкрити заявку'}).click();

    api.on('GET', 'booking/approvals/pending/count', {vacations: 0, businessTrips: 0});
    await page.getByRole('dialog').getByRole('button', {name: 'Погодити'}).click();

    await expect.poll(() => api.requestsTo('PUT', 'booking/vacations/approve/8').length).toBe(1);
    await expect(page.getByLabel('1 чекають рішення')).toHaveCount(0);
  });

  test('a notification link opens the vacation', async ({page, api, signInAs}) => {
    const pending = vacation({id: 9, permissions: permissions({canView: true, canApprove: true})});

    await signInAs(users.departmentDirector);
    api
      .on('GET', 'booking/vacations', [pending])
      .on('GET', 'booking/vacations/9', pending);

    await page.goto('/vacations?open=9');

    await expect(page.getByRole('dialog')).toContainText('Коваль Олена');
    await expect(page).not.toHaveURL(/open=/);
  });
});
