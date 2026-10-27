import {expect, test} from './support/test';
import {isoDate, users, vacationBalance} from './support/data';

test.describe('Home: vacation balance', () => {
  test.beforeEach(async ({signInAs}) => {
    await signInAs(users.employee);
  });

  test('shows whole available days and the accrued days', async ({page, api}) => {
    api.on('GET', /^booking\/vacations\/balance\//, vacationBalance({
      totalDays: 30.5,
      usedDays: 7,
      plannedDays: 5,
      availableDays: 18.5
    }));

    await page.goto('/home');

    const card = page.locator('.balance-card');
    await expect(card.locator('.balance-number')).toHaveText('18');
    await expect(card).toContainText('нараховано 30,5 · 24 на рік');
    await expect(card).toContainText('Використано 7');
    await expect(card).toContainText('Заплановано 5');
    await expect(card).not.toContainText('можна взяти з');
  });

  test('tells when annual vacation becomes available in the first six months', async ({page, api}) => {
    const availableFrom = isoDate(90);

    api.on('GET', /^booking\/vacations\/balance\//, vacationBalance({
      totalDays: 1.25,
      usedDays: 0,
      plannedDays: 0,
      availableDays: 1.25,
      annualVacationAvailableFrom: `${availableFrom}T00:00:00`
    }));

    await page.goto('/home');

    const card = page.locator('.balance-card');
    await expect(card.locator('.balance-number')).toHaveText('1');
    await expect(card).toContainText(`Щорічну відпустку можна взяти з ${Number(availableFrom.slice(8))} `);
    await expect(card).toContainText(availableFrom.slice(0, 4));
  });
});
