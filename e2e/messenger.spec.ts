import {Page} from '@playwright/test';
import {expect, test} from './support/test';
import {attachment, chatMessage, contact, directChat, employee, groupChat, member, users} from './support/data';
import {RawBody} from './support/mock-api';
import {NotificationsHub} from './support/notifications-hub';

const me = users.departmentDirector;
const olena = users.employee.employee;
const iryna = employee(12, 'Шевчук', 'Ірина');
const taras = employee(13, 'Бондар', 'Тарас');

const list = (page: Page) => page.getByRole('navigation', {name: 'Чати'});
const log = (page: Page) => page.getByRole('log');
const composer = (page: Page) => page.getByRole('textbox', {name: /Повідомлення для/});

/** A conversation with messages, answered by the mock API. */
function withChat(api: import('./support/mock-api').MockApi, chat: ReturnType<typeof directChat>, messages: unknown[]) {
  api
    .on('GET', 'communication/messenger/conversations', [chat])
    .on('GET', `communication/messenger/conversations/${chat.id}`, chat)
    .on('GET', `communication/messenger/conversations/${chat.id}/messages`, messages);
}

async function openConnected(page: Page, hub: NotificationsHub, url: string) {
  await page.goto(url);
  await hub.waitForConnection();
}

test.describe('Messenger', () => {
  test.beforeEach(async ({signInAs}) => {
    await signInAs(me);
  });

  test('the menu shows unread messages', async ({page, api}) => {
    api.on('GET', 'communication/messenger/unread/count', {conversations: 2, messages: 5});

    await page.goto('/home');

    await expect(page.getByRole('link', {name: /Повідомлення/})).toBeVisible();
    await expect(page.getByLabel('5 непрочитаних повідомлень')).toBeVisible();
  });

  test('opening a chat shows its messages and marks them read', async ({page, api}) => {
    const chat = directChat(me, olena, {unreadCount: 2, lastMessage: chatMessage({id: 8, text: 'Ви на зміні?'})});
    withChat(api, chat, [
      chatMessage({id: 7, text: 'Доброго ранку!'}),
      chatMessage({id: 8, text: 'Ви на зміні?'})
    ]);
    api.on('GET', 'communication/messenger/unread/count', {conversations: 1, messages: 2});

    await page.goto('/messages');
    const item = list(page).getByRole('link', {name: /Коваль Олена/});
    await expect(item).toContainText('Ви на зміні?');
    await expect(item.getByLabel('2 непрочитаних')).toBeVisible();

    api.on('GET', 'communication/messenger/unread/count', {conversations: 0, messages: 0});
    await item.click();

    await expect(page).toHaveURL(/\/messages\/1$/);
    await expect(log(page)).toContainText('Доброго ранку!');
    await expect(log(page)).toContainText('Ви на зміні?');
    await expect.poll(() => api.requestsTo('PUT', 'communication/messenger/conversations/1/read').map(x => x.body))
      .toEqual([{messageId: 8}]);
    await expect(item.getByLabel('2 непрочитаних')).toHaveCount(0);
    await expect(page.getByLabel(/непрочитаних повідомлень/)).toHaveCount(0);
  });

  test('a sent message is shown at once and once only', async ({page, api, hub}) => {
    const chat = directChat(me, olena);
    withChat(api, chat, [chatMessage({id: 3, text: 'Привіт'})]);
    api.on('POST', 'communication/messenger/conversations/1/messages', request => {
      const body = request.postDataJSON();
      return chatMessage({id: 4, text: body.text, authorId: me.employee.id, authorFullName: me.employee.fullName,
        clientMessageId: body.clientMessageId, createdAt: new Date().toISOString()});
    });

    await openConnected(page, hub, '/messages/1');
    await composer(page).fill('  Так, до 16:00  ');
    await composer(page).press('Enter');

    await expect(log(page).getByText('Так, до 16:00')).toHaveCount(1);
    await expect(composer(page)).toHaveValue('');

    const [sent] = api.requestsTo('POST', 'communication/messenger/conversations/1/messages');
    const body = sent.body as {text: string; clientMessageId: string; replyToMessageId: number | null};
    expect(body.text).toBe('Так, до 16:00');
    expect(body.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);

    // The same message comes over the hub for the other tabs: it isn't added twice.
    await hub.push('chatMessageCreated', chatMessage({id: 4, text: body.text, authorId: me.employee.id,
      clientMessageId: body.clientMessageId}));
    await expect(log(page).getByText('Так, до 16:00')).toHaveCount(1);
    await expect(log(page).getByRole('img', {name: 'Надіслано'})).toBeVisible();

    // Read by Олена.
    await hub.push('chatConversationRead', {conversationId: 1, employeeId: olena.id, lastReadMessageId: 4});
    await expect(log(page).getByRole('img', {name: 'Прочитано'})).toBeVisible();
  });

  test('a message that failed is retried with the same client id', async ({page, api}) => {
    withChat(api, directChat(me, olena), []);
    api.on('POST', 'communication/messenger/conversations/1/messages', {}, 500);

    await page.goto('/messages/1');
    await composer(page).fill('Перевірка');
    await composer(page).press('Enter');

    await expect(log(page)).toContainText('Не надіслано');

    api.on('POST', 'communication/messenger/conversations/1/messages', request =>
      chatMessage({id: 9, text: 'Перевірка', authorId: me.employee.id, clientMessageId: request.postDataJSON().clientMessageId}));
    await log(page).getByRole('button', {name: 'Повторити'}).click();

    await expect(log(page)).not.toContainText('Не надіслано');
    const [first, second] = api.requestsTo('POST', 'communication/messenger/conversations/1/messages')
      .map(x => (x.body as {clientMessageId: string}).clientMessageId);
    expect(second).toBe(first);
  });

  test('incoming messages: shown in the open chat, counted in another one', async ({page, api, hub}) => {
    const chat = directChat(me, olena);
    const group = groupChat(me, [iryna, taras]);
    api
      .on('GET', 'communication/messenger/conversations', [chat, group])
      .on('GET', 'communication/messenger/conversations/1', chat)
      .on('GET', 'communication/messenger/conversations/1/messages', []);

    await openConnected(page, hub, '/messages/1');
    await expect(log(page)).toContainText('Повідомлень ще немає');

    await hub.push('chatTyping', {conversationId: 1, employeeId: olena.id, fullName: olena.fullName});
    await expect(page.getByText('Олена друкує…').first()).toBeVisible();

    await hub.push('chatMessageCreated', chatMessage({id: 20, conversationId: 1, text: 'Я вже тут'}));
    await expect(log(page)).toContainText('Я вже тут');
    await expect(page.getByText('Олена друкує…')).toHaveCount(0);
    await expect.poll(() => api.requestsTo('PUT', 'communication/messenger/conversations/1/read').length).toBe(1);

    await hub.push('chatMessageCreated', chatMessage({id: 21, conversationId: 2, text: 'Хто завтра вийде?',
      authorId: iryna.id, authorFullName: iryna.fullName}));
    const groupItem = list(page).getByRole('link', {name: /Магазин №12 · зміна/});
    await expect(groupItem).toContainText('Ірина: Хто завтра вийде?');
    await expect(groupItem.getByLabel('1 непрочитаних')).toBeVisible();
    // The chat with the new message moves to the top.
    await expect(list(page).getByRole('link').first()).toContainText('Магазин №12 · зміна');
  });

  test('a new chat with a colleague found by name', async ({page, api}) => {
    const chat = directChat(me, iryna, {id: 5});
    api
      .on('GET', /^communication\/messenger\/contacts/, [contact(iryna)])
      .on('POST', 'communication/messenger/conversations/direct', chat)
      .on('GET', 'communication/messenger/conversations/5', chat)
      .on('GET', 'communication/messenger/conversations/5/messages', []);

    await page.goto('/messages');
    await page.getByRole('button', {name: 'Новий чат'}).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('searchbox', {name: 'Пошук працівників'}).fill('шев');
    await dialog.getByRole('option', {name: /Шевчук Ірина/}).click();

    await expect(page).toHaveURL(/\/messages\/5$/);
    expect(api.requestsTo('POST', 'communication/messenger/conversations/direct')[0].body).toEqual({employeeId: iryna.id});
    await expect(page.getByRole('heading', {name: 'Новий чат'})).toHaveCount(0);
  });

  test('a group is created with a title and members', async ({page, api}) => {
    const group = groupChat(me, [iryna, taras], {id: 6, title: 'Нічна зміна'});
    api
      .on('GET', /^communication\/messenger\/contacts/, [contact(iryna), contact(taras)])
      .on('POST', 'communication/messenger/conversations/groups', group)
      .on('GET', 'communication/messenger/conversations/6', group)
      .on('GET', 'communication/messenger/conversations/6/messages', []);

    await page.goto('/messages');
    await page.getByRole('button', {name: 'Новий чат'}).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('tab', {name: 'Група'}).click();

    const create = dialog.getByRole('button', {name: 'Створити групу'});
    await expect(create).toBeDisabled();

    await dialog.getByLabel('Назва групи').fill('Нічна зміна');
    await dialog.getByRole('searchbox', {name: 'Пошук працівників'}).fill('ко');
    await dialog.getByRole('option', {name: /Шевчук Ірина/}).click();
    await dialog.getByRole('option', {name: /Бондар Тарас/}).click();
    await expect(dialog.getByLabel('Обрані колеги')).toContainText('Бондар Тарас');
    await create.click();

    await expect(page).toHaveURL(/\/messages\/6$/);
    expect(api.requestsTo('POST', 'communication/messenger/conversations/groups')[0].body)
      .toEqual({title: 'Нічна зміна', memberIds: [iryna.id, taras.id]});
  });

  test('own message can be edited and deleted', async ({page, api}) => {
    const own = chatMessage({id: 11, text: 'Зміна з 9:00', authorId: me.employee.id, authorFullName: me.employee.fullName});
    withChat(api, directChat(me, olena), [own]);
    api
      .on('PUT', 'communication/messenger/messages/11', {...own, text: 'Зміна з 10:00', editedAt: new Date().toISOString()})
      .on('DELETE', 'communication/messenger/messages/11', {...own, text: null, isDeleted: true});

    await page.goto('/messages/1');
    // Right click opens the actions, as in other messengers.
    await log(page).getByText('Зміна з 9:00').click({button: 'right'});
    await page.getByRole('menuitem', {name: 'Редагувати'}).click();

    await expect(composer(page)).toHaveValue('Зміна з 9:00');
    await composer(page).fill('Зміна з 10:00');
    await composer(page).press('Enter');

    await expect(log(page)).toContainText('Зміна з 10:00');
    await expect(log(page)).toContainText('змінено');
    expect(api.requestsTo('PUT', 'communication/messenger/messages/11')[0].body).toEqual({text: 'Зміна з 10:00'});

    // The actions button shown on hover.
    await log(page).getByText('Зміна з 10:00').hover();
    await log(page).getByRole('button', {name: 'Дії з повідомленням'}).click();
    await page.getByRole('menuitem', {name: 'Видалити'}).click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Видалити'}).click();

    await expect(log(page)).toContainText('Повідомлення видалено');
    await expect(log(page)).not.toContainText('Зміна з 10:00');
  });

  test('others\' messages can be replied to but not changed', async ({page, api}) => {
    withChat(api, directChat(me, olena), [chatMessage({id: 12, text: 'Хто завтра на 8:00?'})]);

    await page.goto('/messages/1');
    await log(page).getByText('Хто завтра на 8:00?').hover();
    await log(page).getByRole('button', {name: 'Дії з повідомленням'}).click();

    await expect(page.getByRole('menuitem', {name: 'Відповісти'})).toBeVisible();
    await expect(page.getByRole('menuitem', {name: 'Видалити'})).toHaveCount(0);
    await expect(page.getByRole('menuitem', {name: 'Редагувати'})).toHaveCount(0);

    await page.getByRole('menuitem', {name: 'Відповісти'}).click();
    await expect(page.getByText('Відповідь Коваль Олена')).toBeVisible();
    await expect(composer(page)).toBeFocused();
  });

  test('a chat with an employee who is no longer available is read-only', async ({page, api}) => {
    withChat(api, directChat(me, olena, {title: null, interlocutor: null, members: [member(me.employee)], canWrite: false}),
      [chatMessage({id: 1, text: 'Старе повідомлення'})]);

    await page.goto('/messages/1');

    await expect(log(page)).toContainText('Старе повідомлення');
    await expect(page.getByText('написати в цей чат не можна')).toBeVisible();
    await expect(composer(page)).toHaveCount(0);
  });

  test('the directory opens a chat with the colleague', async ({page, api}) => {
    const chat = directChat(me, olena, {id: 7});
    api
      .on('GET', /^organization\/employees/, [olena])
      .on('POST', 'communication/messenger/conversations/direct', chat)
      .on('GET', 'communication/messenger/conversations/7', chat)
      .on('GET', 'communication/messenger/conversations/7/messages', []);

    await page.goto('/messages?to=11');

    await expect(page).toHaveURL(/\/messages\/7$/);
    expect(api.requestsTo('POST', 'communication/messenger/conversations/direct')[0].body).toEqual({employeeId: olena.id});
  });

  test('on a phone the list and the chat are separate screens', async ({page, api}) => {
    await page.setViewportSize({width: 375, height: 760});
    withChat(api, directChat(me, olena, {lastMessage: chatMessage({id: 1})}), [chatMessage({id: 1, text: 'Привіт!'})]);

    await page.goto('/messages');
    await list(page).getByRole('link', {name: /Коваль Олена/}).click();

    await expect(list(page)).toBeHidden();
    await expect(log(page)).toContainText('Привіт!');

    await page.getByRole('link', {name: 'До списку чатів'}).click();
    await expect(list(page)).toBeVisible();
    await expect(page).toHaveURL(/\/messages$/);
  });

  test.describe('files', () => {
    /** A 1×1 PNG. */
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const fileInput = (page: Page) => page.locator('input[type="file"]');

    function answerUploads(api: import('./support/mock-api').MockApi) {
      let id = 40;
      api.on('POST', 'communication/messenger/conversations/1/attachments', request => {
        const body = request.postDataBuffer()?.toString('latin1') ?? '';
        const isImage = body.includes('photo.png');
        return attachment({id: ++id, fileName: isImage ? 'photo.png' : 'Довідка.pdf',
          contentType: isImage ? 'image/png' : 'application/pdf', isImage, size: isImage ? png.length : 3});
      });
    }

    test('files are uploaded first and sent with the message', async ({page, api}) => {
      withChat(api, directChat(me, olena), []);
      answerUploads(api);
      api
        .on('GET', /^communication\/messenger\/attachments\/\d+/, new RawBody(png, 'image/png'))
        .on('POST', 'communication/messenger/conversations/1/messages', request => {
          const body = request.postDataJSON();
          return chatMessage({id: 50, authorId: me.employee.id, text: body.text || null, clientMessageId: body.clientMessageId,
            attachments: [attachment({id: 41, fileName: 'Довідка.pdf', size: 3}),
              attachment({id: 42, fileName: 'photo.png', contentType: 'image/png', isImage: true, size: png.length})]});
        });

      await page.goto('/messages/1');
      await fileInput(page).setInputFiles([
        {name: 'Довідка.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf')},
        {name: 'photo.png', mimeType: 'image/png', buffer: png}
      ]);

      const uploads = page.getByRole('list', {name: 'Файли до повідомлення'});
      await expect(uploads.getByRole('listitem')).toHaveCount(2);
      await expect(uploads).toContainText('Довідка.pdf');
      await expect(page.getByRole('button', {name: 'Надіслати'})).toBeEnabled();

      // Files without text are a message too.
      await page.getByRole('button', {name: 'Надіслати'}).click();

      await expect.poll(() => api.requestsTo('POST', 'communication/messenger/conversations/1/messages').length).toBe(1);
      expect(api.requestsTo('POST', 'communication/messenger/conversations/1/messages')[0].body)
        .toMatchObject({text: '', attachmentIds: [41, 42]});
      await expect(uploads).toHaveCount(0);
      await expect(log(page).getByRole('button', {name: 'Відкрити Довідка.pdf'})).toBeVisible();
      await expect(log(page).getByRole('img', {name: 'photo.png'})).toBeVisible();
    });

    test('files that can\'t be sent are not uploaded', async ({page, api}) => {
      withChat(api, directChat(me, olena), []);
      answerUploads(api);

      await page.goto('/messages/1');
      await fileInput(page).setInputFiles({name: 'setup.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ')});

      await expect(page.locator('.p-toast')).toContainText('Такий тип файлів не можна надіслати');
      expect(api.requestsTo('POST', 'communication/messenger/conversations/1/attachments')).toHaveLength(0);
      await expect(page.getByRole('button', {name: 'Надіслати'})).toBeDisabled();
    });

    test('a file dropped from the message is removed on the server', async ({page, api}) => {
      withChat(api, directChat(me, olena), []);
      answerUploads(api);

      await page.goto('/messages/1');
      await fileInput(page).setInputFiles({name: 'Довідка.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf')});
      await page.getByRole('button', {name: 'Прибрати Довідка.pdf'}).click();

      await expect.poll(() => api.requestsTo('DELETE', 'communication/messenger/attachments/41').length).toBe(1);
      await expect(page.getByRole('list', {name: 'Файли до повідомлення'})).toHaveCount(0);
    });

    test('an upload error is shown on the file', async ({page, api}) => {
      withChat(api, directChat(me, olena), []);
      api.on('POST', 'communication/messenger/conversations/1/attachments',
        {ErrorType: 'CMN_MSG_ATTACHMENT_TOO_LARGE', ErrorMessage: 'too large'}, 413);

      await page.goto('/messages/1');
      await fileInput(page).setInputFiles({name: 'Довідка.pdf', mimeType: 'application/pdf', buffer: Buffer.from('pdf')});

      await expect(page.getByRole('list', {name: 'Файли до повідомлення'})).toContainText('Файл більший за 20 МБ');
      await expect(page.getByRole('button', {name: 'Надіслати'})).toBeDisabled();
    });

    test('a received file is downloaded, a picture opens in the viewer', async ({page, api}) => {
      withChat(api, directChat(me, olena), [chatMessage({id: 9, text: 'Графік на листопад', attachments: [
        attachment({id: 5, fileName: 'графік.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
        attachment({id: 6, fileName: 'зміни.png', contentType: 'image/png', isImage: true})
      ]})]);
      api
        .on('GET', /^communication\/messenger\/attachments\/5/, new RawBody(Buffer.from('xlsx'), 'application/octet-stream'))
        .on('GET', /^communication\/messenger\/attachments\/6/, new RawBody(png, 'image/png'));

      await page.goto('/messages/1');

      const download = page.waitForEvent('download');
      await log(page).getByRole('button', {name: 'Завантажити графік.xlsx'}).click();
      expect((await download).suggestedFilename()).toBe('графік.xlsx');
      expect(api.requestsTo('GET', /^communication\/messenger\/attachments\/5\?download=true/)).toHaveLength(1);

      await log(page).getByRole('button', {name: 'Переглянути зміни.png'}).click();
      const viewer = page.getByRole('dialog', {name: 'зміни.png'});
      await expect(viewer.getByRole('img', {name: 'зміни.png'})).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(viewer).toHaveCount(0);
    });

    test('the chat list shows a file message by its file', async ({page, api}) => {
      withChat(api, directChat(me, olena, {lastMessage: chatMessage({id: 3, text: null,
        attachments: [attachment({id: 7, fileName: 'зміни.png', contentType: 'image/png', isImage: true})]})}), []);

      await page.goto('/messages');

      await expect(list(page).getByRole('link', {name: /Коваль Олена/})).toContainText('Фото');
    });
  });
});