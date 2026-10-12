import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/'); await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email); await page.getByLabel('كلمة المرور', { exact: true }).fill(password); await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).not.toBeVisible();
}

test('worker rejection, physical receipt, repair acceptance, reinstallation and irreversible scrap', async ({ page, playwright, browser }, info) => {
  const baseURL = process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Defect tests require localhost.');
  const prefix = `E2E-DEFECT-${Date.now()}`, temporary = 'TemporaryDefect123!', changed = 'ChangedDefect456!';
  const context = await playwright.request.newContext({ baseURL });
  const csrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
  const login = await context.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': csrf }, data: { email: env.BOOTSTRAP_EMAIL, password: env.BOOTSTRAP_PASSWORD } });
  expect(login.status()).toBe(200); const session = await login.json(); const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-XSRF-TOKEN': csrf };
  const call = async (method: string, path: string, data?: unknown, status = 200) => {
    const response = await context.fetch(`/api/v1${path}`, { method, headers, data }); expect(response.status()).toBe(status); return status === 204 ? null : response.json();
  };
  let modelId = '', partId = '', machineId = '', orderId = '', workerId = '';
  const wc = await browser.newContext({ baseURL, viewport: { width: 834, height: 1112 } }); const wp = await wc.newPage(); const errors: string[] = [];
  for (const p of [page, wp]) p.on('pageerror', e => errors.push(e.message));
  const action = async (name: string, submit: string, receipt = false, noteLabel = 'ملاحظات الإجراء') => {
    await page.getByRole('button', { name, exact: true }).click();
    if (receipt) await page.getByLabel('موقع الاستلام', { exact: true }).fill('رف فحص القطع');
    await page.getByLabel(noteLabel, { exact: true }).fill(`${submit}: فحص فعلي للقطعة`);
    await page.getByRole('button', { name: submit, exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  };
  try {
    const model = await call('POST', '/machine-models', { code: `${prefix}-M`, name: `موديل العيوب ${prefix}`, description: '', active: true, version: 0 }, 201); modelId = model.id;
    const part = await call('POST', '/parts', { code: `${prefix}-P`, name: `قطعة الفحص ${prefix}`, description: '', kind: 'SERIALIZED_PIECE', shape: 'STANDARD', stockUnit: 'PIECE', lengthMm: null, widthMm: null, diameterMm: null, defaultInstallMinutes: 10, active: true, version: 0 }, 201); partId = part.id;
    const machine = await call('POST', '/machines', { serialNumber: `${prefix}-MC`, modelId, name: `ماكينة الفحص ${prefix}`, location: '', notes: '', active: true, version: 0 }, 201); machineId = machine.id;
    const bom = await call('POST', `/machines/${machineId}/boms`, {}, 201);
    await call('POST', `/boms/${bom.id}/items`, { version: 0, positionCode: 'A1', partId, quantity: 2, expectedInstallMinutes: 10, notes: '' }, 201);
    await call('POST', `/boms/${bom.id}/publish`, { version: 1 });
    await call('POST', '/warehouse/receipts', { partId, serials: [`${prefix}-S1`, `${prefix}-S2`], location: 'رف الفحص', reference: prefix, notes: '' }, 201);
    const order = await call('POST', '/manufacturing-orders', { code: `${prefix}-ORDER`, title: `فحص وإصلاح ${prefix}`, machineId, bomId: bom.id, responsibleId: session.user.id, deliveryAt: '2030-08-20T12:00:00Z', notes: '', version: 0 }, 201); orderId = order.id;
    await call('POST', `/manufacturing-orders/${orderId}/release`, { version: 0 });
    const worker = await call('POST', '/users', { email: `defect-${Date.now()}@test.easyback.local`, displayName: `عامل العيوب ${prefix}`, password: temporary, active: true, roleIds: [], overrides: { 'tasks.view-assigned': true, 'tasks.work': true, 'tasks.uninstall': true, 'tasks.reject': true }, version: 0 }, 201); workerId = worker.id;
    for (const t of await call('GET', `/assembly/tasks?orderId=${orderId}`)) await call('POST', `/assembly/tasks/${t.id}/assign`, { version: t.version, workerId, notes: '' });
    let stock = await call('GET', `/manufacturing-orders/${orderId}/stock`);
    await call('POST', `/manufacturing-orders/${orderId}/stock/issue`, { version: stock.version, pieceIds: stock.pieces.map((p: { id: string }) => p.id), recipientId: workerId, notes: '' });
    const tasks = await call('GET', `/assembly/tasks?orderId=${orderId}`), repaired = tasks[0], scrapped = tasks[1];
    await signIn(wp, worker.email, temporary);
    await wp.getByLabel('كلمة المرور الحالية', { exact: true }).fill(temporary); await wp.getByLabel('كلمة المرور الجديدة', { exact: true }).fill(changed); await wp.getByLabel('تأكيد كلمة المرور', { exact: true }).fill(changed); await wp.getByRole('button', { name: 'حفظ وتسجيل الدخول مجددًا', exact: true }).click();
    await expect(wp.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible(); await signIn(wp, worker.email, changed); await wp.getByRole('link', { name: 'مهامي', exact: true }).click();
    await wp.getByRole('button', { name: 'رفض A1 / 1', exact: true }).click(); await wp.getByLabel('سبب الرفض', { exact: true }).fill('عيب في سطح تثبيت القطعة'); await wp.getByRole('button', { name: 'رفض القطعة', exact: true }).click(); await expect(wp.getByRole('dialog')).toHaveCount(0);
    await expect(wp.getByText('مرفوض في عهدة العامل', { exact: true })).toBeVisible();
    await wp.getByRole('link', { name: 'بلاغاتي', exact: true }).click(); await expect(wp.locator('tbody tr')).toHaveCount(1); await expect(wp.getByRole('button', { name: `استلام المعيب ${repaired.serialNumber}`, exact: true })).toHaveCount(0);
    await signIn(page, env.BOOTSTRAP_EMAIL, env.BOOTSTRAP_PASSWORD); await page.getByRole('link', { name: 'العيوب والإصلاح', exact: true }).click(); await page.getByLabel('بحث المخزن', { exact: true }).fill(prefix);
    await action(`استلام المعيب ${repaired.serialNumber}`, 'استلام المعيب', true);
    await action(`بدء الإصلاح ${repaired.serialNumber}`, 'بدء الإصلاح');
    await page.setViewportSize({ width: 834, height: 1112 }); await page.screenshot({ path: info.outputPath('repair-tablet-light.png'), fullPage: true });
    await action(`إنهاء الإصلاح ${repaired.serialNumber}`, 'إنهاء الإصلاح');
    const piecesBeforeAccept = await call('GET', '/warehouse/pieces'); expect(piecesBeforeAccept.find((p: { id: string }) => p.id === repaired.pieceId).status).toBe('REPAIRED');
    await action(`استلام المصلح ${repaired.serialNumber}`, 'استلام وفحص المصلح', true, 'نتيجة فحص القطعة المصلحة');
    await page.getByLabel('حالة بلاغ العيب', { exact: true }).selectOption('all'); await expect(page.locator('tbody')).toContainText('استلم سليمًا');
    await page.getByRole('button', { name: `سجل ${repaired.serialNumber}`, exact: true }).click(); await expect(page.getByRole('dialog').locator('.task-history li')).toHaveCount(5); await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    stock = await call('GET', `/manufacturing-orders/${orderId}/stock`); await call('POST', `/manufacturing-orders/${orderId}/stock/reserve`, { version: stock.version });
    stock = await call('GET', `/manufacturing-orders/${orderId}/stock`); await call('POST', `/manufacturing-orders/${orderId}/stock/issue`, { version: stock.version, pieceIds: [repaired.pieceId], recipientId: workerId, notes: 'Reissue repaired serial' });
    await wp.getByRole('link', { name: 'مهامي', exact: true }).click(); await wp.getByRole('button', { name: 'تحديث المهام', exact: true }).click();
    await wp.getByRole('button', { name: 'بدء A1 / 1', exact: true }).click(); await wp.getByRole('button', { name: 'بدء التركيب', exact: true }).click(); await expect(wp.getByRole('dialog')).toHaveCount(0);
    await wp.getByRole('button', { name: 'تركيب A1 / 1', exact: true }).click(); await wp.getByRole('button', { name: 'تأكيد التركيب', exact: true }).click(); await expect(wp.getByRole('dialog')).toHaveCount(0);
    await wp.getByRole('button', { name: 'رفض A1 / 2', exact: true }).click(); await wp.getByLabel('سبب الرفض', { exact: true }).fill('كسر لا يصلح للإصلاح'); await wp.getByRole('button', { name: 'رفض القطعة', exact: true }).click(); await expect(wp.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'تحديث بلاغات العيوب', exact: true }).click();
    await action(`استلام المعيب ${scrapped.serialNumber}`, 'استلام المعيب', true);
    await page.getByRole('button', { name: 'الوضع الداكن', exact: true }).click();
    await page.getByRole('button', { name: `إعدام ${scrapped.serialNumber}`, exact: true }).click(); await page.getByLabel('سبب الإعدام', { exact: true }).fill('تم الفحص والكسر غير قابل للإصلاح'); await page.screenshot({ path: info.outputPath('scrap-dark-tablet.png'), fullPage: true }); await page.getByRole('button', { name: 'إعدام القطعة', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('tbody')).toContainText('معدم'); await expect(page.getByRole('button', { name: `بدء الإصلاح ${scrapped.serialNumber}`, exact: true })).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 }); await page.screenshot({ path: info.outputPath('defects-dark-desktop.png'), fullPage: true });
    await wp.getByRole('link', { name: 'بلاغاتي', exact: true }).click(); await wp.getByRole('button', { name: 'تحديث بلاغات العيوب', exact: true }).click(); await wp.getByLabel('حالة بلاغ العيب', { exact: true }).selectOption('all'); await expect(wp.locator('tbody tr')).toHaveCount(2);
    await wp.getByRole('button', { name: `سجل ${scrapped.serialNumber}`, exact: true }).click(); await expect(wp.getByRole('dialog')).toContainText('غير قابل للإصلاح');
    for (const [name, width, height] of [['tablet', 834, 1112], ['mobile', 390, 844]] as const) { await wp.setViewportSize({ width, height }); expect(await wp.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy(); await wp.screenshot({ path: info.outputPath(`defect-history-${name}.png`), fullPage: true }); }
    await call('POST', '/warehouse/receipts', { partId, serials: [scrapped.serialNumber], location: '', reference: '', notes: '' }, 409);
    const balance = (await call('GET', '/warehouse/balances')).find((b: { partId: string }) => b.partId === partId); expect(balance.installed).toBe(1); expect(balance.scrapped).toBe(1); expect(balance.available).toBe(0); expect(errors).toEqual([]);
  } finally {
    await wc.close();
    if (orderId) {
      for (let d of (await call('GET', '/defects')).filter((d: { orderId: string }) => d.orderId === orderId)) {
        if (d.status === 'REPORTED') d = (await call('POST', `/defects/${d.id}/receive`, { version: d.version, notes: 'E2E cleanup physical return', location: 'Fixture quarantine' })).defect;
        if (['QUARANTINED', 'IN_REPAIR', 'REPAIRED'].includes(d.status)) await call('POST', `/defects/${d.id}/scrap`, { version: d.version, notes: 'E2E cleanup fixture disposition' });
      }
      for (const t of (await call('GET', `/assembly/tasks?orderId=${orderId}`)).filter((t: { status: string }) => t.status === 'INSTALLED')) await call('POST', `/assembly/tasks/${t.id}/uninstall`, { version: t.version, reason: 'E2E cleanup fixture removal' });
      const stock = await call('GET', `/manufacturing-orders/${orderId}/stock`);
      for (const p of stock.pieces.filter((p: { status: string }) => p.status === 'ISSUED')) await call('POST', `/manufacturing-orders/${orderId}/stock/pieces/${p.id}/return`, { version: (await call('GET', `/manufacturing-orders/${orderId}/stock`)).version, condition: 'GOOD', notes: 'E2E cleanup inspected fixture return' });
      const o = await call('GET', `/manufacturing-orders/${orderId}`); if (o.status !== 'CANCELLED') await call('POST', `/manufacturing-orders/${orderId}/cancel`, { version: o.version, reason: 'E2E cleanup' });
    }
    if (machineId) { const m = (await call('GET', '/machines')).find((m: { id: string }) => m.id === machineId); await call('PUT', `/machines/${machineId}`, { ...m, active: false }); }
    if (partId) { const p = (await call('GET', '/parts')).find((p: { id: string }) => p.id === partId); await call('PUT', `/parts/${partId}`, { ...p, active: false }); }
    if (modelId) { const m = (await call('GET', '/machine-models')).find((m: { id: string }) => m.id === modelId); await call('PUT', `/machine-models/${modelId}`, { ...m, active: false }); }
    if (workerId) { const u = (await call('GET', '/users')).find((u: { id: string }) => u.id === workerId); await call('PUT', `/users/${workerId}`, { ...u, active: false }); }
    const logoutCsrf = (await (await context.get('/api/v1/auth/csrf')).json()).token; expect((await context.post('/api/v1/auth/logout', { headers: { ...headers, 'X-XSRF-TOKEN': logoutCsrf } })).status()).toBe(204); await context.dispose();
  }
});
