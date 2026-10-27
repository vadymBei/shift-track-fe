import {Page} from '@playwright/test';
import {expect, test} from './support/test';
import {isoDate, users, vacationBalance} from './support/data';

async function openCreateDialog(page: Page) {
  await page.goto('/vacations');
  await page.getByRole('button', {name: 'Створити заявку'}).click();

  const dialog = page.getByRole('dialog').filter({hasText: 'Нова заявка на відпустку'});
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectType(page: Page, label: string) {
  const option = page.getByRole('option', {name: label, exact: true});

  // A click while the previous overlay is still closing is ignored, so open the list until the option shows.
  await expect(async () => {
    await page.locator('#vacationType').click();
    await expect(option).toBeVisible({timeout: 1_000});
  }).toPass();

  await option.click();
  await expect(page.locator('#vacationType')).toHaveText(label);
}

test.describe('Create vacation', () => {
  test.beforeEach(async ({signInAs}) => {
    await signInAs(users.employee);
  });

  test('annual vacation is limited to dates after six months of work', async ({page, api}) => {
    api.on('GET', /^booking\/vacations\/balance\//, vacationBalance({
      annualVacationAvailableFrom: `${isoDate(60)}T00:00:00`
    }));

    const dialog = await openCreateDialog(page);
    const hint = dialog.getByText('Щорічну основну відпустку можна взяти з');

    await selectType(page, 'Основна щорічна відпустка');
    await expect(hint).toBeVisible();

    // Other vacation types don't depend on the length of service.
    await selectType(page, 'Бонусна відпустка');
    await expect(hint).toHaveCount(0);
  });

  test('no restriction after six months of work', async ({page, api}) => {
    api.on('GET', /^booking\/vacations\/balance\//, vacationBalance({
      annualVacationAvailableFrom: `${isoDate(-30)}T00:00:00`
    }));

    const dialog = await openCreateDialog(page);

    await selectType(page, 'Основна щорічна відпустка');

    await expect(dialog.getByText('Щорічну основну відпустку можна взяти з')).toHaveCount(0);
  });
});
