import { test, expect, type Page, type Route } from '@playwright/test';

const userId = '11111111-1111-4111-8111-111111111111';
const taskId = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';
const otherId = '44444444-4444-4444-8444-444444444444';
const defectId = '55555555-5555-4555-8555-555555555555';
const globalPermissions = ['orders.view', 'orders.view-assigned', 'tasks.view', 'tasks.view-assigned', 'defects.view'];
const limitedPermissions = ['orders.view-assigned', 'tasks.view-assigned'];
const task = { id: taskId, requirementId: 'r', orderId, orderCode: 'OTHER-ORDER', orderTitle: 'Other employee private order', orderStatus: 'OPEN', machineId: otherId, machineSerial: 'M1', machineName: 'Machine', deliveryAt: '2030-01-01T08:00:00Z', positionCode: 'A1', occurrence: 1, partId: otherId, partCode: 'P1', partName: 'Other employee private part', expectedMinutes: 10, requirementNotes: '', workerId: otherId, workerName: 'Other employee', status: 'PENDING', version: 0, startedAt: null, pieceId: null, serialNumber: null, pieceStatus: null, installationId: null, installedAt: null, workRunning: false };
const order = { id: orderId, code: 'OTHER-ORDER', title: 'Other employee private order', machineId: otherId, bomId: otherId, responsibleId: otherId, responsibleName: 'Other employee', deliveryAt: task.deliveryAt, notes: '', status: 'OPEN', machineSerial: 'M1', machineName: 'Machine', modelName: 'Model', bomRevision: 1, version: 0, createdAt: task.deliveryAt, openedAt: task.deliveryAt, cancelledAt: null, cancellationReason: null, items: [], requiredCount: 1, installedCount: 0, assemblyCompletedAt: null, configurationVersion: 0, testedAt: null, completedAt: null, deliveredAt: null, deliveryNotes: null };
const defect = { id: defectId, taskId, pieceId: otherId, orderId, orderCode: 'OTHER-ORDER', machineSerial: 'M1', positionCode: 'A1', occurrence: 1, serialNumber: 'OTHER-SERIAL', partCode: 'P1', partName: 'Other employee private part', reportedBy: otherId, reporterName: 'Other employee', reason: 'Other employee private defect reason', status: 'REPORTED', pieceStatus: 'REJECTED', version: 0, reportedAt: task.deliveryAt };

async function mockSession(page: Page, initialPermissions = globalPermissions) {
  const baseURL = process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Cache regressions require localhost.');
  let permissions = initialPermissions;
  const requests: string[] = [];
  let delayed: Route | undefined;
  let delayTasks = false;
  const user = () => ({ id: userId, email: 'review@example.invalid', displayName: 'Cache regression', active: true, mustChangePassword: false, version: 0, roleIds: [], overrides: {}, permissions });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', ''); requests.push(path);
    const global = permissions.includes('orders.view');
    let json: unknown;
    if (path === '/auth/csrf') json = { token: 'synthetic-csrf' };
    else if (path === '/auth/refresh') json = { accessToken: 'synthetic-token', user: user() };
    else if (path === '/auth/me') json = user();
    else if (path === '/notifications/unread-count') json = { count: 0 };
    else if (path === '/assembly/tasks') {
      if (delayTasks && global) { delayed = route; return; }
      json = global ? [task] : [];
    } else if (path === '/manufacturing-orders') json = global ? [order] : [];
    else if (path === '/defects') json = global ? [defect] : [];
    else if (path === `/assembly/tasks/${taskId}` && global) json = { task, events: [], workTime: { total: { grossSeconds: 0, netSeconds: 0, unconfirmedSessions: 0 }, sessions: [] } };
    else if (path === `/manufacturing-orders/${orderId}` && global) json = order;
    else if (path === `/manufacturing-orders/${orderId}/stock` && global) json = { orderId, version: 0, status: 'OPEN', requirements: [], pieces: [] };
    else if (path === `/defects/${defectId}` && global) json = { defect, events: [] };
    else if (path === '/files' && global) json = [{ id: otherId, filename: 'Private drawing.png', contentType: 'image/png', sizeBytes: 68, version: 0, uploadedBy: 'Other employee', uploadedAt: task.deliveryAt, canManage: false }];
    else if (path === `/files/${otherId}` && global) return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jTioAAAAASUVORK5CYII=', 'base64') });
    else return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
    await route.fulfill({ status: 200, json });
  });
  return {
    requests,
    downgrade: async () => { permissions = limitedPermissions; const response = page.waitForResponse(r => r.url().endsWith('/auth/me')); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await response; },
    delayTasks: () => { delayTasks = true; },
    delayed: () => delayed,
    release: async () => { await delayed?.fulfill({ status: 200, json: [task] }); },
    reorder: async () => { permissions = [...globalPermissions].reverse(); const response = page.waitForResponse(r => r.url().endsWith('/auth/me')); await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await response; },
  };
}

for (const resource of [
  { path: '/tasks', endpoint: '/assembly/tasks', privateText: task.partName },
  { path: '/orders', endpoint: '/manufacturing-orders', privateText: order.title },
  { path: '/defects', endpoint: '/defects', privateText: defect.reason },
]) test(`permission downgrade discards cached ${resource.path} rows`, async ({ page }) => {
  const session = await mockSession(page);
  await page.goto(resource.path); await expect(page.getByText(resource.privateText, { exact: true })).toBeVisible();
  const before = session.requests.filter(p => p === resource.endpoint).length;
  await session.downgrade();
  await expect(page.getByText(resource.privateText, { exact: true })).toHaveCount(0);
  await expect.poll(() => session.requests.filter(p => p === resource.endpoint).length).toBeGreaterThan(before);
  await expect(page.getByText('لا توجد نتائج', { exact: true }).or(page.getByText('لا توجد طلبات', { exact: true }))).toBeVisible();
});

test('permission downgrade removes an open task detail and attachment preview', async ({ page }) => {
  const session = await mockSession(page);
  await page.goto(`/tasks?task=${taskId}`);
  const detail = page.getByRole('dialog'); await expect(detail).toContainText(task.partName);
  await detail.getByRole('button', { name: 'مرفقات الطلب', exact: true }).click();
  await page.getByRole('button', { name: 'عرض Private drawing.png', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Private drawing.png', exact: true })).toBeVisible();
  await session.downgrade();
  await expect(page.getByRole('img', { name: 'Private drawing.png', exact: true })).toHaveCount(0);
  await expect(page.getByText(task.partName, { exact: true })).toHaveCount(0);
  await expect(page.getByText('Private drawing.png', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('السجل غير موجود.');
});

test('an old in-flight task response cannot restore private rows after downgrade', async ({ page }) => {
  const session = await mockSession(page); session.delayTasks();
  await page.goto('/tasks'); await expect.poll(() => Boolean(session.delayed())).toBe(true);
  await session.downgrade(); await expect(page.getByText('لا توجد نتائج', { exact: true })).toBeVisible();
  await session.release();
  await expect(page.getByText(task.partName, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'مهامي', exact: true })).toBeVisible();
});

test('permission order alone preserves the current authorized screen and dialog', async ({ page }) => {
  const session = await mockSession(page);
  await page.goto('/tasks'); await expect(page.getByText(task.partName, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'تفاصيل A1 / 1', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(task.partName);
  const before = session.requests.filter(p => p === '/assembly/tasks').length;
  await session.reorder();
  await expect(page.getByRole('dialog')).toContainText(task.partName);
  expect(session.requests.filter(p => p === '/assembly/tasks').length).toBe(before);
});

test('stock issue waits for the parent order version before allowing cancellation', async ({ page }) => {
  await mockSession(page, [...globalPermissions, 'stock.view', 'stock.issue', 'orders.cancel']);
  let issued = false, parentRefresh: Route | undefined, cancellationVersion: number | undefined;
  const stock = () => ({ orderId, version: issued ? 1 : 0, status: 'OPEN', requirements: [], pieces: [{ id: otherId, serialNumber: 'OTHER-SERIAL', partId: otherId, partCode: 'P1', partName: task.partName, location: '', status: issued ? 'ISSUED' : 'RESERVED', version: 0, requirementId: task.requirementId, orderId, orderCode: order.code, positionCode: 'A1', recipientName: issued ? order.responsibleName : null, taskId: null, defectId: null }] });
  await page.route(`**/api/v1/manufacturing-orders/${orderId}**`, async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/stock/recipients')) return route.fulfill({ json: [] });
    if (path.endsWith('/stock/issue')) { issued = true; return route.fulfill({ json: stock() }); }
    if (path.endsWith('/stock')) return route.fulfill({ json: stock() });
    if (path.endsWith('/cancel')) {
      cancellationVersion = route.request().postDataJSON().version;
      return route.fulfill({ status: 409, json: { code: cancellationVersion === 1 ? 'STOCK_RETURN_BEFORE_CANCEL' : 'STALE_VERSION' } });
    }
    if (issued) { parentRefresh = route; return; }
    return route.fulfill({ json: order });
  });
  await page.goto(`/orders/${orderId}`);
  await page.getByRole('checkbox', { name: 'تحديد OTHER-SERIAL', exact: true }).check();
  await page.getByRole('button', { name: `صرف المحدد (${new Intl.NumberFormat('ar-EG').format(1)})`, exact: true }).click();
  await page.getByRole('button', { name: 'تأكيد الصرف', exact: true }).click();
  await expect.poll(() => Boolean(parentRefresh)).toBe(true);
  await expect(page.getByRole('dialog')).toBeVisible();
  await parentRefresh!.fulfill({ json: { ...order, version: 1 } });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).click();
  await page.getByLabel('سبب الإلغاء', { exact: true }).fill('Immediate cancellation after issue');
  await page.getByRole('button', { name: 'تأكيد إلغاء الطلب', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('أرجع جميع القطع المصروفة');
  expect(cancellationVersion).toBe(1);
});
