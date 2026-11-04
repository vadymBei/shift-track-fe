import {Page} from '@playwright/test';
import {expect, test} from './support/test';
import {chatMessage, directChat, employee, groupChat, notification, users} from './support/data';
import {MockApi} from './support/mock-api';

const me = users.departmentDirector;
const iryna = employee(12, 'Шевчук', 'Ірина');
const taras = employee(13, 'Бондар', 'Тарас');

const log = (page: Page) => page.getByRole('log');
const composer = (page: Page) => page.getByRole('textbox', {name: /Повідомлення для/});
const picker = (page: Page) => page.getByRole('listbox', {name: 'Кого згадати'});

function withGroup(api: MockApi, overrides: Record<string, unknown> = {}, messages: unknown[] = []) {
  const group = groupChat(me, [iryna, taras], overrides);
  api
    .on('GET', 'communication/messenger/conversations', [group])
    .on('GET', 'communication/messenger/conversations/2', group)
    .on('GET', 'communication/messenger/conversations/2/messages', messages);
  return group;
}

test.describe('Messenger: mentions', () => {
  test.beforeEach(async ({signInAs}) => {
    await signInAs(me);
  });

  test('typing @ suggests members, the chosen one is sent as a mention', async ({page, api}) => {
    withGroup(api);
    api.on('POST', 'communication/messenger/conversations/2/messages', request => chatMessage({
      id: 30, conversationId: 2, authorId: me.employee.id, text: request.postDataJSON().text,
      clientMessageId: request.postDataJSON().clientMessageId,
      mentions: [{employeeId: iryna.id, fullName: iryna.fullName}]
    }));

    await page.goto('/messages/2');
    await composer(page).pressSequentially('Привіт, @');

    // Everyone but me.
    await expect(picker(page).getByRole('option')).toHaveText([/Ірина Шевчук/, /Тарас Бондар/]);

    await composer(page).pressSequentially('ір');
    await expect(picker(page).getByRole('option')).toHaveText([/Ірина Шевчук/]);
    await composer(page).press('Enter');

    await expect(picker(page)).toHaveCount(0);
    await expect(composer(page)).toHaveValue('Привіт, @Ірина Шевчук ');

    await composer(page).pressSequentially('вийдеш завтра?');
    await composer(page).press('Enter');

    await expect.poll(() => api.requestsTo('POST', 'communication/messenger/conversations/2/messages').length).toBe(1);
    expect(api.requestsTo('POST', 'communication/messenger/conversations/2/messages')[0].body)
      .toMatchObject({text: `Привіт, <@${iryna.id}> вийдеш завтра?`});
    await expect(log(page).locator('.mention')).toHaveText('@Ірина Шевчук');
  });

  test('arrows choose another member, Escape closes the list', async ({page, api}) => {
    withGroup(api);

    await page.goto('/messages/2');
    await composer(page).pressSequentially('@');
    await composer(page).press('ArrowDown');
    await expect(picker(page).getByRole('option', {selected: true})).toHaveText(/Тарас Бондар/);
    await composer(page).press('Tab');
    await expect(composer(page)).toHaveValue('@Тарас Бондар ');

    await composer(page).pressSequentially('і @');
    await expect(picker(page)).toBeVisible();
    await composer(page).press('Escape');
    await expect(picker(page)).toHaveCount(0);
  });

  test('there are no mentions in a direct chat', async ({page, api}) => {
    const chat = directChat(me, iryna);
    api
      .on('GET', 'communication/messenger/conversations', [chat])
      .on('GET', 'communication/messenger/conversations/1', chat)
      .on('GET', 'communication/messenger/conversations/1/messages', []);

    await page.goto('/messages/1');
    await composer(page).pressSequentially('@Ір');

    await expect(picker(page)).toHaveCount(0);
  });

  test('a mention of me stands out, the chat is marked with @', async ({page, api}) => {
    withGroup(api, {unreadCount: 1, hasUnreadMention: true, lastMessage: chatMessage({id: 40, conversationId: 2,
      authorId: iryna.id, authorFullName: iryna.fullName, text: `<@${me.employee.id}>, глянь графік`,
      mentions: [{employeeId: me.employee.id, fullName: me.employee.fullName}]})}, [
      chatMessage({id: 40, conversationId: 2, authorId: iryna.id, authorFullName: iryna.fullName,
        text: `<@${me.employee.id}>, глянь графік`, mentions: [{employeeId: me.employee.id, fullName: me.employee.fullName}]})
    ]);

    await page.goto('/messages');
    const item = page.getByRole('navigation', {name: 'Чати'}).getByRole('link', {name: /Магазин №12/});
    await expect(item.getByRole('img', {name: 'Вас згадали'})).toBeVisible();
    await expect(item).toContainText('Ірина: @Вадим Бей, глянь графік');

    await item.click();
    await expect(log(page).locator('.mention.me')).toHaveText('@Вадим Бей');
    await expect(item.getByRole('img', {name: 'Вас згадали'})).toHaveCount(0);
  });

  test('editing keeps the mentions', async ({page, api}) => {
    const own = chatMessage({id: 41, conversationId: 2, authorId: me.employee.id, authorFullName: me.employee.fullName,
      text: `<@${taras.id}> до 9:00`, mentions: [{employeeId: taras.id, fullName: taras.fullName}]});
    withGroup(api, {}, [own]);
    api.on('PUT', 'communication/messenger/messages/41', request => ({...own, text: request.postDataJSON().text}));

    await page.goto('/messages/2');
    await log(page).getByText('до 9:00').click({button: 'right'});
    await page.getByRole('menuitem', {name: 'Редагувати'}).click();

    await expect(composer(page)).toHaveValue('@Тарас Бондар до 9:00');
    await composer(page).fill('@Тарас Бондар до 10:00');
    await composer(page).press('Enter');

    await expect.poll(() => api.requestsTo('PUT', 'communication/messenger/messages/41').length).toBe(1);
    expect(api.requestsTo('PUT', 'communication/messenger/messages/41')[0].body).toEqual({text: `<@${taras.id}> до 10:00`});
  });

  test('a muted chat: no pop-up but counted in the menu, and a mention notification opens it', async ({page, api, hub}) => {
    const group = withGroup(api, {isMuted: true});

    await page.goto('/home');
    await hub.waitForConnection();
    await page.getByRole('link', {name: /Повідомлення/}).waitFor();

    api.on('GET', 'communication/messenger/unread/count', {conversations: 1, messages: 1});
    await hub.push('chatMessageCreated', chatMessage({id: 50, conversationId: 2, authorId: taras.id,
      authorFullName: taras.fullName, text: 'Хто на касі?'}));
    await expect(page.getByLabel('1 непрочитаних повідомлень')).toBeVisible();
    await expect(page.locator('.p-toast')).not.toContainText('Хто на касі?');

    await hub.notificationReceived(notification({id: 70, type: 'Mention', moduleType: 'Messenger', entityId: group.id,
      title: 'Бондар Тарас згадав вас у «Магазин №12 · зміна»', message: '@Вадим Бей, підміниш?'}));
    await expect(page.locator('.p-toast')).toContainText('згадав вас');

    api.on('GET', 'communication/notifications', [notification({id: 70, type: 'Mention', moduleType: 'Messenger',
      entityId: group.id, title: 'Бондар Тарас згадав вас у «Магазин №12 · зміна»', message: '@Вадим Бей, підміниш?'})]);
    await page.getByRole('button', {name: /^Сповіщення/}).filter({visible: true}).first().click();
    await page.getByRole('dialog', {name: 'Сповіщення'}).getByText('згадав вас').click();

    await expect(page).toHaveURL(/\/messages\/2$/);
  });

  test('a chat is muted in its details', async ({page, api}) => {
    withGroup(api);
    api.on('PUT', 'communication/messenger/conversations/2/muted', request =>
      groupChat(me, [iryna, taras], {isMuted: request.postDataJSON().muted}));

    await page.goto('/messages/2');
    await page.getByRole('button', {name: 'Учасники групи'}).click();
    await page.getByRole('switch', {name: /Без сповіщень/}).click();

    await expect.poll(() => api.requestsTo('PUT', 'communication/messenger/conversations/2/muted').map(x => x.body))
      .toEqual([{muted: true}]);
    await expect(page.getByRole('navigation', {name: 'Чати'}).getByRole('img', {name: 'Без сповіщень'})).toBeVisible();
  });
});
