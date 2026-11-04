import {expect, test} from './support/test';
import {users} from './support/data';

test.describe('Employee: hire date', () => {
  // The dialog requires the patronymic.
  const olena = {...users.employee.employee, patronymic: 'Ігорівна'};

  test.beforeEach(async ({signInAs, api}) => {
    await signInAs(users.unitDirector);
    api.on('GET', 'organization/employees', [olena]);
  });

  async function openDialog(page: import('@playwright/test').Page) {
    await page.goto('/administration/employees');
    await page.locator('tbody tr').filter({hasText: 'Коваль Олена'})
      .getByRole('button', {name: 'Редагувати працівника'}).click();
    // The date picker's calendar is a dialog too.
    const dialog = page.getByRole('dialog').filter({has: page.getByLabel('Прізвище')});
    await expect(dialog.getByLabel('Прізвище')).toHaveValue('Коваль');
    return dialog;
  }

  test('without a hire date the registration date counts, and a hire date can be set', async ({page, api}) => {
    api
      .on('GET', 'organization/employees/11', {...olena, hireDate: null})
      .on('PUT', 'organization/employees', {...olena, hireDate: '2024-01-10T00:00:00'});

    const dialog = await openDialog(page);
    await expect(dialog).toContainText('відпустка рахується від реєстрації в системі (15.01.2025)');

    // The date picker reads typed keys (it ignores a value set without key presses).
    const hireDate = dialog.getByLabel('Дата прийому на роботу');
    await hireDate.pressSequentially('10.01.2024');
    await hireDate.press('Tab');
    await expect(dialog).toContainText('Від неї рахуються відпустка і перші 6 місяців роботи');
    await page.keyboard.press('Escape');

    await dialog.getByRole('button', {name: 'Зберегти'}).click();

    await expect.poll(() => api.requestsTo('PUT', 'organization/employees').length).toBe(1);
    expect(api.requestsTo('PUT', 'organization/employees')[0].body).toMatchObject({id: olena.id, hireDate: '2024-01-10'});
  });

  test('the hire date is shown and can be cleared', async ({page, api}) => {
    api
      .on('GET', 'organization/employees/11', {...olena, hireDate: '2023-05-02T00:00:00'})
      .on('PUT', 'organization/employees', {...olena, hireDate: null});

    const dialog = await openDialog(page);
    const hireDate = dialog.getByLabel('Дата прийому на роботу');
    await expect(hireDate).toHaveValue('02.05.2023');

    await hireDate.press('ControlOrMeta+a');
    await hireDate.press('Backspace');
    await hireDate.press('Tab');
    await page.keyboard.press('Escape');
    await dialog.getByRole('button', {name: 'Зберегти'}).click();

    await expect.poll(() => api.requestsTo('PUT', 'organization/employees').length).toBe(1);
    expect(api.requestsTo('PUT', 'organization/employees')[0].body).toMatchObject({hireDate: null});
  });
});
