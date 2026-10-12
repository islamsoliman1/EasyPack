import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/'); await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email); await page.getByLabel('كلمة المرور', { exact: true }).fill(password); await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).not.toBeVisible();
}
test('separate worker assignments, custody, installation, removal and machine history', async ({ page, playwright, browser }, info) => {
  const baseURL = process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Assembly tests require localhost.');
  const prefix = `E2E-ASSEMBLY-${Date.now()}`, temporary = 'TemporaryAssembly123!', changed = 'ChangedAssembly456!';
  const context = await playwright.request.newContext({ baseURL });
  const csrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
  const login = await context.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': csrf }, data: { email: env.BOOTSTRAP_EMAIL, password: env.BOOTSTRAP_PASSWORD } });
  expect(login.status()).toBe(200); const session = await login.json(); const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-XSRF-TOKEN': csrf };
  const call = async (method: string, path: string, data?: unknown, status = 200) => {
    const response = await context.fetch(`/api/v1${path}`, { method, headers, data }); expect(response.status()).toBe(status); return status === 204 ? null : response.json();
  };
  let modelId = '', partId = '', machineId = '', orderId = ''; const workerIds: string[] = [];
  const workerContexts: Awaited<ReturnType<typeof browser.newContext>>[] = []; const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    const model = await call('POST', '/machine-models', { code: `${prefix}-M`, name: `موديل التجميع ${prefix}`, description: '', active: true, version: 0 }, 201); modelId = model.id;
    const part = await call('POST', '/parts', { code: `${prefix}-P`, name: `قطعة التجميع ${prefix}`, description: '', kind: 'SERIALIZED_PIECE', shape: 'STANDARD', stockUnit: 'PIECE', lengthMm: null, widthMm: null, diameterMm: null, defaultInstallMinutes: 12, active: true, version: 0 }, 201); partId = part.id;
    const machine = await call('POST', '/machines', { serialNumber: `${prefix}-MC`, modelId, name: `ماكينة التجميع ${prefix}`, location: '', notes: '', active: true, version: 0 }, 201); machineId = machine.id;
    const bom = await call('POST', `/machines/${machineId}/boms`, {}, 201);
    for (const [version, positionCode] of [[0, 'A1'], [1, 'A2']] as const) await call('POST', `/boms/${bom.id}/items`, { version, positionCode, partId, quantity: 2, expectedInstallMinutes: 12, notes: 'تثبيت القطعة بالمقاس المحدد', }, 201);
    await call('POST', `/boms/${bom.id}/publish`, { version: 2 });
    await call('POST', '/warehouse/receipts', { partId, serials: [1, 2, 3, 4].map(n => `${prefix}-S${n}`), location: 'رف التجميع', reference: prefix, notes: '' }, 201);
    const order = await call('POST', '/manufacturing-orders', { code: `${prefix}-ORDER`, title: `تجميع ماكينة ${prefix}`, machineId, bomId: bom.id, responsibleId: session.user.id, deliveryAt: '2030-08-20T12:00:00Z', notes: '', version: 0 }, 201); orderId = order.id;
    await call('POST', `/manufacturing-orders/${orderId}/release`, { version: 0 });
    const workers = [];
    for (const n of [1, 2]) {
      const worker = await call('POST', '/users', { email: `assembly-${Date.now()}-${n}@test.easyback.local`, displayName: `عامل التجميع ${n} ${prefix}`, password: temporary, active: true, roleIds: [], overrides: { 'tasks.view-assigned': true, 'tasks.work': true, 'tasks.uninstall': true }, version: 0 }, 201);
      workers.push(worker); workerIds.push(worker.id);
    }
    await signIn(page, env.BOOTSTRAP_EMAIL, env.BOOTSTRAP_PASSWORD); await page.goto(`/orders/${orderId}`);
    await page.getByRole('main').getByRole('link', { name: 'مهام التجميع', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(4);
    for (const position of ['A1', 'A2']) for (const n of [1, 2]) {
      await page.getByRole('button', { name: `تكليف ${position} / ${n}`, exact: true }).click(); await page.getByLabel('العامل المكلف', { exact: true }).selectOption(workers[n - 1].id);
      if (position === 'A1' && n === 1) { await page.setViewportSize({ width: 834, height: 1112 }); await page.screenshot({ path: info.outputPath('assignment-tablet.png'), fullPage: true }); }
      await page.getByRole('button', { name: 'تكليف عامل', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.screenshot({ path: info.outputPath('manager-tasks-tablet.png'), fullPage: true });
    await page.goto(`/orders/${orderId}`);
    const allocated = await call('GET', `/manufacturing-orders/${orderId}/stock`);
    const serials = ['A1', 'A2'].map(position => allocated.pieces.filter((p: { positionCode: string }) => p.positionCode === position).map((p: { serialNumber: string }) => p.serialNumber));
    const reinstalledSerial = serials[0][0];
    for (const n of [1, 2]) {
      for (const pieces of serials) await page.getByRole('checkbox', { name: `تحديد ${pieces[n - 1]}`, exact: true }).check();
      await page.getByRole('button', { name: 'صرف المحدد (2)', exact: true }).click(); await page.getByLabel('المستلم', { exact: true }).selectOption(workers[n - 1].id);
      await page.getByRole('button', { name: 'تأكيد الصرف', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    const workerPages: Page[] = [];
    for (const n of [0, 1]) {
      const wc = await browser.newContext({ baseURL, viewport: { width: 834, height: 1112 } }); workerContexts.push(wc); const wp = await wc.newPage(); workerPages.push(wp); wp.on('pageerror', e => errors.push(e.message));
      await signIn(wp, workers[n].email, temporary); await wp.getByLabel('كلمة المرور الحالية', { exact: true }).fill(temporary); await wp.getByLabel('كلمة المرور الجديدة', { exact: true }).fill(changed); await wp.getByLabel('تأكيد كلمة المرور', { exact: true }).fill(changed); await wp.getByRole('button', { name: 'حفظ وتسجيل الدخول مجددًا', exact: true }).click();
      await expect(wp.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible(); await signIn(wp, workers[n].email, changed); await wp.getByRole('link', { name: 'مهامي', exact: true }).click(); await expect(wp.locator('tbody tr')).toHaveCount(2);
      await expect(wp.getByRole('link', { name: 'المخزن', exact: true })).toHaveCount(0); await expect(wp.getByRole('link', { name: 'طلبات التصنيع', exact: true })).toHaveCount(0); await expect(wp.locator('tbody')).not.toContainText(workers[1 - n].displayName);
      const sc = (await (await wc.request.get('/api/v1/auth/csrf')).json()).token;
      const auth = await wc.request.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': sc }, data: { email: workers[n].email, password: changed } }); expect(auth.status()).toBe(200);
      const wh = { Authorization: `Bearer ${(await auth.json()).accessToken}`, 'X-XSRF-TOKEN': sc };
      const own = await wc.request.get('/api/v1/assembly/tasks', { headers: wh }); expect(own.status()).toBe(200); expect(await own.json()).toHaveLength(2);
      const other = (await call('GET', `/assembly/tasks?orderId=${orderId}`)).find((t: { workerId: string }) => t.workerId === workers[1 - n].id);
      expect((await wc.request.get(`/api/v1/assembly/tasks/${other.id}`, { headers: wh })).status()).toBe(404);
      expect((await wc.request.post(`/api/v1/assembly/tasks/${other.id}/install`, { headers: wh, data: { version: other.version, notes: '' } })).status()).toBe(404);
      expect((await wc.request.get(`/api/v1/manufacturing-orders/${orderId}`, { headers: wh })).status()).toBe(403);
      expect((await wc.request.get(`/api/v1/machines/${machineId}/assembly`, { headers: wh })).status()).toBe(403);
    }
    const work = async (wp: Page, position: string, occurrence: number) => {
      await wp.getByRole('button', { name: `بدء ${position} / ${occurrence}`, exact: true }).click(); await wp.getByRole('button', { name: 'بدء التركيب', exact: true }).click(); await expect(wp.getByRole('dialog')).toHaveCount(0);
      await wp.getByRole('button', { name: `تركيب ${position} / ${occurrence}`, exact: true }).click(); await wp.getByLabel('ملاحظات التجميع', { exact: true }).fill('تم التثبيت وفحص الربط'); await wp.getByRole('button', { name: 'تأكيد التركيب', exact: true }).click(); await expect(wp.getByRole('dialog')).toHaveCount(0);
    };
    for (const n of [0, 1]) for (const position of ['A1', 'A2']) await work(workerPages[n], position, n + 1);
    await page.goto(`/orders/${orderId}`); await expect(page.getByText('بانتظار تجربة التشغيل', { exact: true })).toBeVisible(); await expect(page.getByText('4 / 4 قطعة مركبة', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: info.outputPath('assembly-ready-desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).click(); await page.getByLabel('سبب الإلغاء', { exact: true }).fill('محاولة قبل الفك'); await page.getByRole('button', { name: 'تأكيد إلغاء الطلب', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('فك القطع المركبة'); await page.getByRole('button', { name: 'رجوع', exact: true }).click();
    const wp = workerPages[0]; await wp.getByRole('button', { name: 'الوضع الداكن', exact: true }).click(); await wp.screenshot({ path: info.outputPath('worker-tasks-dark-tablet.png'), fullPage: true });
    await wp.getByRole('button', { name: 'فك A1 / 1', exact: true }).click(); await wp.getByLabel('سبب الفك', { exact: true }).fill('فحص المحاذاة وإعادة التجهيز'); await wp.screenshot({ path: info.outputPath('uninstall-dark-tablet.png'), fullPage: true }); await wp.getByRole('button', { name: 'فك القطعة', exact: true }).click(); await expect(wp.getByRole('dialog')).toHaveCount(0);
    await page.reload(); await expect(page.getByText('قيد التجميع', { exact: true })).toBeVisible(); await expect(page.getByText('3 / 4 قطعة مركبة', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `إرجاع ${reinstalledSerial}`, exact: true }).click(); await page.getByLabel('سبب الإرجاع', { exact: true }).fill('القطعة سليمة ومفكوكة للفحص'); await page.getByRole('button', { name: 'تأكيد الإرجاع', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.order-warehouse').getByRole('button', { name: 'حجز المتاح', exact: true }).click(); await page.getByRole('checkbox', { name: `تحديد ${reinstalledSerial}`, exact: true }).check(); await page.getByRole('button', { name: 'صرف المحدد (1)', exact: true }).click(); await page.getByLabel('المستلم', { exact: true }).selectOption(workers[0].id); await page.getByRole('button', { name: 'تأكيد الصرف', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await wp.reload(); await work(wp, 'A1', 1); await wp.getByRole('button', { name: 'تفاصيل A1 / 1', exact: true }).click(); await expect(wp.getByRole('dialog')).toContainText('فحص المحاذاة'); await expect(wp.getByRole('dialog')).toContainText('إرجاع القطعة');
    for (const [name, width, height] of [['tablet', 834, 1112], ['mobile', 390, 844]] as const) { await wp.setViewportSize({ width, height }); expect(await wp.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy(); await wp.screenshot({ path: info.outputPath(`task-history-dark-${name}.png`), fullPage: true }); }
    await page.goto(`/machines/${machineId}/assembly`); await expect(page.locator('tbody tr')).toHaveCount(4); await expect(page.getByText('نسخة التركيب: 6', { exact: true })).toBeVisible(); await page.getByRole('checkbox', { name: 'إظهار سجل الفك أيضًا', exact: true }).check(); await expect(page.locator('tbody tr')).toHaveCount(5); await expect(page.locator('tbody')).toContainText('تم فكه');
    await page.screenshot({ path: info.outputPath('machine-history-desktop.png'), fullPage: true }); await page.setViewportSize({ width: 834, height: 1112 }); await page.getByRole('button', { name: 'الوضع الداكن', exact: true }).click();
    await page.locator('.table-wrap').evaluate(el => { el.scrollLeft = -el.scrollWidth; }); await page.screenshot({ path: info.outputPath('machine-history-dark-tablet.png'), fullPage: true });
    const final = await call('GET', `/manufacturing-orders/${orderId}`); expect(final.status).toBe('AWAITING_TESTING'); expect(final.installedCount).toBe(4); expect(final.configurationVersion).toBe(6); expect(errors).toEqual([]);
  } finally {
    for (const wc of workerContexts) await wc.close();
    if (orderId) {
      const tasks = await call('GET', `/assembly/tasks?orderId=${orderId}`);
      for (const t of tasks.filter((t: { status: string }) => t.status === 'INSTALLED')) await call('POST', `/assembly/tasks/${t.id}/uninstall`, { version: t.version, reason: 'E2E cleanup; fixture removed' });
      const stock = await call('GET', `/manufacturing-orders/${orderId}/stock`);
      for (const p of stock.pieces.filter((p: { status: string }) => p.status === 'ISSUED')) await call('POST', `/manufacturing-orders/${orderId}/stock/pieces/${p.id}/return`, { version: (await call('GET', `/manufacturing-orders/${orderId}/stock`)).version, condition: 'GOOD', notes: 'E2E cleanup; inspected fixture return' });
      const o = await call('GET', `/manufacturing-orders/${orderId}`); if (o.status !== 'CANCELLED') await call('POST', `/manufacturing-orders/${orderId}/cancel`, { version: o.version, reason: 'E2E cleanup' });
    }
    if (machineId) { const m = (await call('GET', '/machines')).find((m: { id: string }) => m.id === machineId); await call('PUT', `/machines/${machineId}`, { ...m, active: false }); }
    if (partId) { const p = (await call('GET', '/parts')).find((p: { id: string }) => p.id === partId); await call('PUT', `/parts/${partId}`, { ...p, active: false }); }
    if (modelId) { const m = (await call('GET', '/machine-models')).find((m: { id: string }) => m.id === modelId); await call('PUT', `/machine-models/${modelId}`, { ...m, active: false }); }
    const users = await call('GET', '/users'); for (const uid of workerIds) { const u = users.find((u: { id: string }) => u.id === uid); await call('PUT', `/users/${uid}`, { ...u, active: false }); }
    const logoutCsrf = (await (await context.get('/api/v1/auth/csrf')).json()).token; expect((await context.post('/api/v1/auth/logout', { headers: { ...headers, 'X-XSRF-TOKEN': logoutCsrf } })).status()).toBe(204); await context.dispose();
  }
});
