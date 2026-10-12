import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/'); await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email); await page.getByLabel('كلمة المرور', { exact: true }).fill(password); await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
}
test('operations-only department handles failure, configuration invalidation, retest, completion and separate delivery', async ({ page, playwright }, info) => {
  const baseURL = process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Operations tests require localhost.');
  const prefix = `E2E-OPERATIONS-${Date.now()}`, temporary = 'TemporaryOperations123!', changed = 'ChangedOperations456!';
  const context = await playwright.request.newContext({ baseURL });
  const csrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
  const auth = await context.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': csrf }, data: { email: env.BOOTSTRAP_EMAIL, password: env.BOOTSTRAP_PASSWORD } }); expect(auth.status()).toBe(200);
  const session = await auth.json(), headers = { Authorization: `Bearer ${session.accessToken}`, 'X-XSRF-TOKEN': csrf };
  const call = async (method: string, path: string, data?: unknown, status = 200) => { const r = await context.fetch(`/api/v1${path}`, { method, headers, data }); expect(r.status()).toBe(status); return status === 204 ? null : r.json(); };
  let modelId = '', partId = '', machineId = '', orderId = ''; const ids: string[] = [], clients: typeof context[] = [], errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    const model = await call('POST', '/machine-models', { code: `${prefix}-M`, name: `موديل التشغيل ${prefix}`, description: '', active: true, version: 0 }, 201); modelId = model.id;
    const part = await call('POST', '/parts', { code: `${prefix}-P`, name: `قطعة التشغيل ${prefix}`, description: '', kind: 'SERIALIZED_PIECE', shape: 'STANDARD', stockUnit: 'PIECE', lengthMm: null, widthMm: null, diameterMm: null, defaultInstallMinutes: 10, active: true, version: 0 }, 201); partId = part.id;
    const machine = await call('POST', '/machines', { serialNumber: `${prefix}-MC`, modelId, name: `ماكينة التشغيل ${prefix}`, location: '', notes: '', active: true, version: 0 }, 201); machineId = machine.id;
    const bom = await call('POST', `/machines/${machineId}/boms`, {}, 201); await call('POST', `/boms/${bom.id}/items`, { version: 0, positionCode: 'A1', partId, quantity: 1, expectedInstallMinutes: 10, notes: '' }, 201); await call('POST', `/boms/${bom.id}/publish`, { version: 1 });
    await call('POST', '/warehouse/receipts', { partId, serials: [`${prefix}-S1`], location: 'رف التشغيل', reference: prefix, notes: '' }, 201);
    const order = await call('POST', '/manufacturing-orders', { code: `${prefix}-ORDER`, title: `تجربة ماكينة ${prefix}`, machineId, bomId: bom.id, responsibleId: session.user.id, deliveryAt: '2030-08-20T12:00:00Z', notes: '', version: 0 }, 201); orderId = order.id; await call('POST', `/manufacturing-orders/${orderId}/release`, { version: 0 });
    const createUser = async (name: string, overrides: Record<string, boolean>) => {
      const user = await call('POST', '/users', { email: `${name}-${Date.now()}@test.easyback.local`, displayName: `${name} ${prefix}`, password: temporary, active: true, roleIds: [], overrides, version: 0 }, 201); ids.push(user.id);
      const c = await playwright.request.newContext({ baseURL }); clients.push(c); let sc = (await (await c.get('/api/v1/auth/csrf')).json()).token;
      let r = await c.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': sc }, data: { email: user.email, password: temporary } }); expect(r.status()).toBe(200);
      let h = { Authorization: `Bearer ${(await r.json()).accessToken}`, 'X-XSRF-TOKEN': sc };
      expect((await c.post('/api/v1/auth/password', { headers: h, data: { currentPassword: temporary, newPassword: changed, confirmation: changed } })).status()).toBe(204);
      sc = (await (await c.get('/api/v1/auth/csrf')).json()).token;
      r = await c.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': sc }, data: { email: user.email, password: changed } }); expect(r.status()).toBe(200); h = { Authorization: `Bearer ${(await r.json()).accessToken}`, 'X-XSRF-TOKEN': sc };
      return { user, c, h };
    };
    const worker = await createUser('assembler', { 'tasks.view-assigned': true, 'tasks.work': true, 'tasks.uninstall': true });
    const operator = await createUser('operator', { 'operations.view': true, 'operations.start': true, 'operations.finish': true, 'operations.resolve': true, 'operations.deliver': true });
    let task = (await call('GET', `/assembly/tasks?orderId=${orderId}`))[0]; await call('POST', `/assembly/tasks/${task.id}/assign`, { version: task.version, workerId: worker.user.id, notes: '' });
    let stock = await call('GET', `/manufacturing-orders/${orderId}/stock`); await call('POST', `/manufacturing-orders/${orderId}/stock/issue`, { version: stock.version, pieceIds: [stock.pieces[0].id], recipientId: worker.user.id, notes: '' });
    const work = async (action: string) => { task = (await call('GET', `/assembly/tasks/${task.id}`)).task; const r = await worker.c.post(`/api/v1/assembly/tasks/${task.id}/${action}`, { headers: worker.h, data: { version: task.version, notes: 'Checked assembly', reason: 'Alignment adjustment' } }); expect(r.status()).toBe(200); };
    await work('start'); await work('install');
    for (const path of ['/manufacturing-orders', '/warehouse/pieces', '/machines', '/assembly/tasks']) expect((await operator.c.get(`/api/v1${path}`, { headers: operator.h })).status()).toBe(403);
    await signIn(page, operator.user.email, changed); await page.getByRole('link', { name: 'تجارب التشغيل', exact: true }).click();
    await expect(page.getByRole('link', { name: 'المخزن', exact: true })).toHaveCount(0); await expect(page.getByRole('link', { name: 'طلبات التصنيع', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: order.title, exact: true }).click();
    const start = async (first = false) => {
      await page.getByRole('button', { name: 'بدء تجربة جديدة', exact: true }).click();
      if (first) { await page.getByLabel('بند الفحص 1', { exact: true }).fill('فحص المحاذاة'); await page.getByLabel('معيار النجاح 1', { exact: true }).fill('طبقًا للمقاس المعتمد في رسم التجربة'); await page.getByRole('button', { name: 'إضافة بند فحص', exact: true }).click(); await page.getByLabel('بند الفحص 2', { exact: true }).fill('فحص التشغيل'); await page.getByLabel('معيار النجاح 2', { exact: true }).fill('تشغيل مستقر وفق إجراء التجربة'); }
      await page.getByRole('dialog').getByRole('button', { name: 'بدء تجربة جديدة', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByText('قيد تجربة التشغيل', { exact: true })).toBeVisible();
    };
    await start(true); await expect(page.locator('.operations-trial')).toContainText(`${prefix}-S1`);
    await page.getByRole('button', { name: 'تسجيل نتيجة التجربة', exact: true }).click(); await page.getByLabel('نتيجة فحص المحاذاة', { exact: true }).selectOption('FAIL'); await page.getByLabel('نتيجة فحص التشغيل', { exact: true }).selectOption('PASS'); await page.getByLabel('خلاصة التجربة', { exact: true }).fill('المحاذاة تحتاج ضبط');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'تسجيل نتيجة التجربة', exact: true })).toBeDisabled(); await page.getByLabel('ملاحظات فحص المحاذاة', { exact: true }).fill('انحراف عن المقاس المعتمد'); await page.screenshot({ path: info.outputPath('failed-check-desktop.png'), fullPage: true }); await page.getByRole('dialog').getByRole('button', { name: 'تسجيل نتيجة التجربة', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('معالجة بعد التجربة', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'بدء تجربة جديدة', exact: true })).toHaveCount(0);
    const resolve = async () => { await page.getByRole('button', { name: 'تسجيل المعالجة وإعادة التجربة', exact: true }).click(); await page.getByLabel('تفاصيل المعالجة', { exact: true }).fill('تم ضبط المحاذاة ومراجعة الربط'); await page.getByRole('dialog').getByRole('button', { name: 'تسجيل المعالجة وإعادة التجربة', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); };
    await resolve(); await start(); await work('uninstall'); await page.getByRole('button', { name: 'تحديث تجربة التشغيل', exact: true }).click(); await expect(page.getByText('أُبطلت لتغير التركيب', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'تسجيل المعالجة وإعادة التجربة', exact: true })).toHaveCount(0);
    await work('install'); await page.getByRole('button', { name: 'تحديث تجربة التشغيل', exact: true }).click(); await resolve(); await start();
    await page.getByRole('button', { name: 'تسجيل نتيجة التجربة', exact: true }).click(); await page.getByLabel('نتيجة فحص المحاذاة', { exact: true }).selectOption('PASS'); await page.getByLabel('نتيجة فحص التشغيل', { exact: true }).selectOption('PASS'); await page.getByLabel('خلاصة التجربة', { exact: true }).fill('تم اجتياز بنود الفحص'); await page.getByRole('dialog').getByRole('button', { name: 'تسجيل نتيجة التجربة', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('مكتمل', { exact: true })).toBeVisible(); let detail = await call('GET', `/operations/orders/${orderId}`); expect(detail.order.deliveredAt).toBeNull(); expect(detail.trials).toHaveLength(3); expect(detail.trials.map((t: { status: string }) => t.status)).toEqual(['PASSED', 'INVALIDATED', 'FAILED']);
    for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 834, 1112], ['mobile', 390, 844]] as const) { await page.setViewportSize({ width, height }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy(); await page.screenshot({ path: info.outputPath(`operations-${name}.png`), fullPage: true }); }
    await page.setViewportSize({ width: 834, height: 1112 }); await page.getByRole('button', { name: 'الوضع الداكن', exact: true }).click(); await page.getByRole('button', { name: 'تسجيل التسليم الفعلي', exact: true }).click(); await page.getByLabel('بيانات التسليم والمستلم', { exact: true }).fill('استلم مسؤول العميل الماكينة بعد التجربة'); await page.screenshot({ path: info.outputPath('delivery-dark-tablet.png'), fullPage: true }); await page.getByRole('dialog').getByRole('button', { name: 'تسجيل التسليم الفعلي', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', { name: 'تسجيل التسليم الفعلي', exact: true })).toHaveCount(0);
    detail = await call('GET', `/operations/orders/${orderId}`); expect(detail.order.deliveredAt).not.toBeNull(); expect(detail.events.at(-1).action).toBe('DELIVERED'); expect(errors).toEqual([]);
  } finally {
    if (orderId) {
      const d = await call('GET', `/operations/orders/${orderId}`); const running = d.trials.find((t: { status: string }) => t.status === 'RUNNING'); if (running) await call('POST', `/operations/trials/${running.id}/abort`, { version: running.version, notes: 'E2E cleanup' });
      if (d.order.status !== 'COMPLETED' && d.order.status !== 'CANCELLED') {
        for (const t of await call('GET', `/assembly/tasks?orderId=${orderId}`)) if (t.status === 'INSTALLED') await call('POST', `/assembly/tasks/${t.id}/uninstall`, { version: t.version, reason: 'E2E fixture cleanup' });
        const s = await call('GET', `/manufacturing-orders/${orderId}/stock`); for (const p of s.pieces) if (p.status === 'ISSUED') await call('POST', `/manufacturing-orders/${orderId}/stock/pieces/${p.id}/return`, { version: (await call('GET', `/manufacturing-orders/${orderId}/stock`)).version, condition: 'GOOD', notes: 'E2E fixture cleanup' });
        await call('POST', `/manufacturing-orders/${orderId}/cancel`, { version: (await call('GET', `/manufacturing-orders/${orderId}`)).version, reason: 'E2E cleanup' });
      }
    }
    for (const [path, id] of [['/machines', machineId], ['/parts', partId], ['/machine-models', modelId]]) if (id) { const row = (await call('GET', path)).find((r: { id: string }) => r.id === id); await call('PUT', `${path}/${id}`, { ...row, active: false }); }
    for (const id of ids) { const u = (await call('GET', '/users')).find((u: { id: string }) => u.id === id); await call('PUT', `/users/${id}`, { ...u, active: false }); }
    for (const c of clients) await c.dispose();
    const sc = (await (await context.get('/api/v1/auth/csrf')).json()).token; expect((await context.post('/api/v1/auth/logout', { headers: { ...headers, 'X-XSRF-TOKEN': sc } })).status()).toBe(204); await context.dispose();
  }
});
