import {Page, Request} from '@playwright/test';
import {expect, test} from './support/test';
import {chatMessage, directChat, users} from './support/data';
import {MockApi} from './support/mock-api';

const me = users.departmentDirector;
const olena = users.employee.employee;
const chat = directChat(me, olena, {lastMessage: chatMessage({id: 100, text: 'До завтра'})});

const log = (page: Page) => page.getByRole('log');
const search = (page: Page) => page.getByRole('search', {name: 'Пошук у чаті'});
const bubble = (page: Page, id: number) => page.locator(`[data-message-id="${id}"]`);

/** The newest page holds 51–100; older messages come only with untilId, as the API gives them. */
function withHistory(api: MockApi) {
  const all = Array.from({length: 100}, (_, i) => chatMessage({
    id: i + 1,
    text: i + 1 === 100 ? 'До завтра' : i + 1 === 90 ? 'Поставка буде о 10:00' : i + 1 === 12 ? 'Чи прийшла поставка?' : `Повідомлення ${i + 1}`
  }));
  api
    .on('GET', 'communication/messenger/conversations', [chat])
    .on('GET', `communication/messenger/conversations/${chat.id}`, chat)
    .on('GET', /^communication\/messenger\/conversations\/1\/messages(\?|$)/, (request: Request) => {
      const params = new URL(request.url()).searchParams;
      const before = Number(params.get('beforeId') ?? 101);
      const until = params.get('untilId');
      const take = Number(params.get('take') ?? 50);
      if (until) {
        return all.filter(x => x.id < before && x.id >= Number(until) - take);
      }
      return all.filter(x => x.id < before).slice(-take);
    })
    .on('GET', /^communication\/messenger\/conversations\/1\/messages\/search/, (request: Request) =>
      new URL(request.url()).searchParams.get('q')?.toLowerCase() === 'поставка'
        ? {messageIds: [90, 12], hasMore: false}
        : {messageIds: [], hasMore: false});
}

test.describe('Messenger: search in a chat', () => {
  test.beforeEach(async ({signInAs, api}) => {
    await signInAs(me);
    withHistory(api);
  });

  test('finds messages, marks the text and goes to older matches loading the history', async ({page, api}) => {
    await page.goto('/messages/1');
    await expect(log(page)).toContainText('До завтра');

    await page.getByRole('button', {name: 'Пошук у чаті'}).click();
    await search(page).getByRole('textbox', {name: 'Пошук у чаті'}).fill('поставка');

    await expect(search(page)).toContainText('1 з 2');
    await expect(bubble(page, 90).locator('mark')).toHaveText('Поставка');
    await expect(bubble(page, 90)).toHaveClass(/found/);
    await expect(bubble(page, 90)).toBeInViewport();
    expect(api.requestsTo('GET', 'communication/messenger/conversations/1/messages/search')[0].path)
      .toContain('q=' + encodeURIComponent('поставка'));

    // Message 12 isn't loaded yet: the history is loaded back to it, without gaps.
    await search(page).getByRole('button', {name: 'Попередній збіг'}).click();
    await expect(search(page)).toContainText('2 з 2');
    await expect(bubble(page, 12)).toBeInViewport();
    await expect(bubble(page, 12).locator('mark')).toHaveText('поставка');
    expect(api.requestsTo('GET', /^communication\/messenger\/conversations\/1\/messages\?.*untilId=12/)).toHaveLength(1);
    await expect(bubble(page, 30)).toHaveCount(1);
    await expect(search(page).getByRole('button', {name: 'Попередній збіг'})).toBeDisabled();

    // Shift+Enter goes back to the newer match.
    await search(page).getByRole('textbox').press('Shift+Enter');
    await expect(search(page)).toContainText('1 з 2');
    await expect(bubble(page, 90)).toBeInViewport();

    await search(page).getByRole('textbox').press('Escape');
    await expect(search(page)).toHaveCount(0);
    await expect(log(page).locator('mark')).toHaveCount(0);
  });

  test('says when nothing is found and waits for two letters', async ({page, api}) => {
    await page.goto('/messages/1');
    await page.getByRole('button', {name: 'Пошук у чаті'}).click();
    const input = search(page).getByRole('textbox');
    await expect(input).toBeFocused();

    await input.fill('п');
    await page.waitForTimeout(500);
    expect(api.requestsTo('GET', 'communication/messenger/conversations/1/messages/search')).toHaveLength(0);

    await input.fill('квитанція');
    await expect(search(page)).toContainText('Не знайдено');
    await expect(search(page).getByRole('button', {name: 'Наступний збіг'})).toBeDisabled();
  });
});
