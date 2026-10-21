import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const injectedEmail = process.env.EASYBACK_E2E_EMAIL;
const injectedPassword = process.env.EASYBACK_E2E_PASSWORD;
if (Boolean(injectedEmail) !== Boolean(injectedPassword)) throw new Error('Provide both EASYBACK_E2E_EMAIL and EASYBACK_E2E_PASSWORD.');
const env = injectedEmail && injectedPassword
  ? { BOOTSTRAP_EMAIL: injectedEmail, BOOTSTRAP_PASSWORD: injectedPassword }
  : Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const notificationName = (count: number) => `الإشعارات، ${new Intl.NumberFormat('ar-EG').format(count)} غير مقروء`;
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/'); await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email); await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click(); await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
}

test('personal notifications persist, poll in foreground, retry reads and open exact task and preparation', async ({ page, playwright }, info) => {
  const baseURL = process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Notification fixtures require localhost.');
  const prefix = `E2E-NOTIFY-${Date.now()}`, temporary = 'TemporaryNotify123!', changed = 'ChangedNotify456!';
  const context = await playwright.request.newContext({ baseURL });
  let csrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
  const response = await context.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': csrf }, data: { email: env.BOOTSTRAP_EMAIL, password: env.BOOTSTRAP_PASSWORD } }); expect(response.status()).toBe(200);
  const session = await response.json(); const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-XSRF-TOKEN': csrf };
  const call = async (method: string, path: string, data?: unknown, status = 200) => { const r = await context.fetch(`/api/v1${path}`, { method, headers, data }); expect(r.status(), await r.text()).toBe(status); return status === 204 ? null : r.json(); };
  const clients: typeof context[] = [], users: string[] = [], errors: string[] = [];
  let modelId = '', partId = '', machineId = '', orderId = '';
  page.on('pageerror', e => errors.push(e.message));
  try {
    const createUser = async (name: string, overrides: Record<string, boolean>) => {
      const user = await call('POST', '/users', { email: `${name}-${prefix}@test.easyback.local`, displayName: `${name} ${prefix}`, password: temporary, active: true, roleIds: [], overrides, version: 0 }, 201); users.push(user.id);
      const client = await playwright.request.newContext({ baseURL }); clients.push(client);
      const sc = (await (await client.get('/api/v1/auth/csrf')).json()).token;
      const auth = await client.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': sc }, data: { email: user.email, password: temporary } }); expect(auth.status()).toBe(200);
      const h = { Authorization: `Bearer ${(await auth.json()).accessToken}`, 'X-XSRF-TOKEN': sc };
      expect((await client.post('/api/v1/auth/password', { headers: h, data: { currentPassword: temporary, newPassword: changed } })).status()).toBe(204);
      return user;
    };
    const worker = await createUser('worker', { 'tasks.view-assigned': true, 'tasks.work': true });
    const preparer = await createUser('preparer', { 'orders.view': true, 'preparation.manage': true });
    const model = await call('POST', '/machine-models', { code: `${prefix}-M`, name: prefix, description: '', active: true, version: 0 }, 201); modelId = model.id;
    const part = await call('POST', '/parts', { code: `${prefix}-P`, name: 'قطعة الإشعارات', description: '', kind: 'SERIALIZED_PIECE', shape: 'STANDARD', stockUnit: 'PIECE', lengthMm: null, widthMm: null, diameterMm: null, defaultInstallMinutes: 10, active: true, version: 0 }, 201); partId = part.id;
    const machine = await call('POST', '/machines', { serialNumber: `${prefix}-MC`, modelId, name: prefix, location: '', notes: '', active: true, version: 0 }, 201); machineId = machine.id;
    const bom = await call('POST', `/machines/${machineId}/boms`, {}, 201);
    await call('POST', `/boms/${bom.id}/items`, { version: 0, positionCode: 'N1', partId, quantity: 1, expectedInstallMinutes: 10, notes: '' }, 201); await call('POST', `/boms/${bom.id}/publish`, { version: 1 });
    const order = await call('POST', '/manufacturing-orders', { code: `${prefix}-ORDER`, title: prefix, machineId, bomId: bom.id, responsibleId: session.user.id, deliveryAt: '2030-08-20T12:00:00Z', notes: '', version: 0 }, 201); orderId = order.id;
    await call('POST', `/manufacturing-orders/${orderId}/release`, { version: 0 });
    const task = (await call('GET', `/assembly/tasks?orderId=${orderId}`))[0];
    await page.clock.install(); await signIn(page, worker.email, changed);
    const bell = page.getByRole('button', { name: /^الإشعارات،/ }); await expect(bell).toHaveAccessibleName(notificationName(0));
    await call('POST', `/assembly/tasks/${task.id}/assign`, { version: task.version, workerId: worker.id, notes: '' });
    await page.clock.fastForward(31000); await expect(bell).toHaveAccessibleName(notificationName(1));
    await bell.click(); await expect(page.getByRole('region', { name: 'آخر الإشعارات' })).toContainText('تم إسناد مهمة إليك');
    await page.keyboard.press('Escape'); await expect(page.getByRole('region', { name: 'آخر الإشعارات' })).toHaveCount(0); await expect(bell).toBeFocused();
    await bell.click(); await expect(bell).toHaveAccessibleName(notificationName(1));
    // A failed read keeps its badge and exposes a retry after navigation.
    await page.route('**/api/v1/notifications/*/read', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"NETWORK"}' }));
    await page.getByRole('region', { name: 'آخر الإشعارات' }).getByRole('link').filter({ hasText: 'تم إسناد مهمة إليك' }).click();
    await expect(page).toHaveURL(new RegExp(`/tasks\\?task=${task.id}$`)); await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('تعذر تحديد الإشعار كمقروء'); await expect(bell).toHaveAccessibleName(notificationName(1));
    await page.unroute('**/api/v1/notifications/*/read');
    // Close the task modal to expose the retry control in the header.
    await page.keyboard.press('Escape'); await expect(page).toHaveURL(/\/tasks$/);
    await page.getByRole('alert').getByRole('button', { name: 'إعادة المحاولة' }).click(); await expect(bell).toHaveAccessibleName(notificationName(0));
    await page.goBack(); await expect(page).toHaveURL(new RegExp(`task=${task.id}`)); await expect(page.getByRole('dialog')).toBeVisible();
    await page.reload(); await expect(page.getByRole('dialog')).toBeVisible(); await expect(bell).toHaveAccessibleName(notificationName(0));
    await page.keyboard.press('Escape'); await bell.click(); await page.getByRole('link', { name: 'عرض كل الإشعارات' }).click();
    await expect(page.getByRole('heading', { name: 'الإشعارات', exact: true })).toBeVisible(); await expect(page.locator('.notification-items')).toContainText('تم إسناد مهمة إليك');
    await page.getByLabel('غير المقروء فقط').check(); await expect(page.getByText('لا توجد إشعارات', { exact: true })).toBeVisible(); await page.getByLabel('غير المقروء فقط').uncheck();
    await page.setViewportSize({ width: 834, height: 1112 }); await bell.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); await page.screenshot({ path: info.outputPath('notifications-tablet.png'), fullPage: true });
    await page.keyboard.press('Escape');
    let polls = 0; page.on('request', request => { if (request.url().endsWith('/notifications/unread-count')) polls++; });
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const hiddenPolls = polls; await page.clock.fastForward(61000); expect(polls).toBe(hiddenPolls);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(() => polls).toBeGreaterThan(hiddenPolls);
    await page.context().setOffline(true); const offlinePolls = polls; await page.clock.fastForward(61000); expect(polls).toBe(offlinePolls);
    await page.context().setOffline(false); await expect.poll(() => polls).toBeGreaterThan(offlinePolls);
    await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
    const stock = await call('GET', `/manufacturing-orders/${orderId}/stock`);
    await call('POST', `/manufacturing-orders/${orderId}/stock/preparation`, { version: stock.version, requirementId: stock.requirements[0].requirementId, notes: '' });
    const prep = (await call('GET', '/warehouse/preparations')).find((p: { orderId: string }) => p.orderId === orderId);
    await signIn(page, preparer.email, changed); await bell.click();
    await expect(page.getByRole('region', { name: 'آخر الإشعارات' })).not.toContainText('تم إسناد مهمة إليك');
    await page.getByRole('region', { name: 'آخر الإشعارات' }).getByRole('link').filter({ hasText: 'طلب تجهيز قطع' }).click();
    await expect(page).toHaveURL(new RegExp(`/preparations\\?preparation=${prep.id}$`)); await expect(page.getByRole('dialog')).toContainText('قطعة الإشعارات');
    await page.reload(); await expect(page.getByRole('dialog')).toContainText('قطعة الإشعارات'); await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/preparations$/); await page.goBack(); await expect(page.getByRole('dialog')).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await page.context().setOffline(false);
    if (orderId) { const order = await call('GET', `/manufacturing-orders/${orderId}`); if (order.status !== 'CANCELLED') await call('POST', `/manufacturing-orders/${orderId}/cancel`, { version: order.version, reason: 'Notification E2E cleanup' }); }
    for (const [path, id] of [['/machines', machineId], ['/parts', partId], ['/machine-models', modelId]]) if (id) { const row = (await call('GET', path)).find((r: { id: string }) => r.id === id); await call('PUT', `${path}/${id}`, { ...row, active: false }); }
    for (const id of users) { const user = (await call('GET', '/users')).find((u: { id: string }) => u.id === id); await call('PUT', `/users/${id}`, { ...user, active: false }); }
    for (const client of clients) await client.dispose();
    csrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
    expect((await context.post('/api/v1/auth/logout', { headers: { ...headers, 'X-XSRF-TOKEN': csrf } })).status()).toBe(204); await context.dispose();
  }
});
