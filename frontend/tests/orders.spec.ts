import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
}
test('manufacturing draft, frozen release, assigned-only access, cancellation and responsive layouts', async ({ page, playwright, browser }, testInfo) => {
  const baseURL = process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Orders tests require localhost.');
  const stamp = Date.now(), prefix = `E2E-ORDER-${stamp}`, email = `order-${stamp}@test.easyback.local`;
  const context = await playwright.request.newContext({ baseURL });
  const csrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
  const login = await context.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': csrf }, data: { email: env.BOOTSTRAP_EMAIL, password: env.BOOTSTRAP_PASSWORD } });
  expect(login.status()).toBe(200); const session = await login.json();
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-XSRF-TOKEN': csrf };
  const call = async (method: string, path: string, data?: unknown, status = 200) => {
    const response = await context.fetch(`/api/v1${path}`, { method, headers, data });
    expect(response.status()).toBe(status); return status === 204 ? null : response.json();
  };
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let workerContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    const model = await call('POST', '/machine-models', { code: `${prefix}-M`, name: `موديل الطلب ${stamp}`, description: '', active: true, version: 0 }, 201);
    const part = await call('POST', '/parts', { code: `${prefix}-P`, name: `قطعة الطلب ${stamp}`, description: '', kind: 'SERIALIZED_PIECE', shape: 'STANDARD', stockUnit: 'PIECE', lengthMm: null, widthMm: null, diameterMm: null, defaultInstallMinutes: 15, active: true, version: 0 }, 201);
    const machine = await call('POST', '/machines', { serialNumber: `${prefix}-MC`, modelId: model.id, name: `ماكينة الطلب ${stamp}`, location: 'التجربة', notes: '', active: true, version: 0 }, 201);
    const draft = await call('POST', `/machines/${machine.id}/boms`, {}, 201);
    for (const [version, positionCode] of [[0, 'A1'], [1, 'A2']] as const) await call('POST', `/boms/${draft.id}/items`, { positionCode, partId: part.id, quantity: 2, expectedInstallMinutes: 15, notes: '', version }, 201);
    await call('POST', `/boms/${draft.id}/publish`, { version: 2 });
    const worker = await call('POST', '/users', { email, displayName: `مسؤول الطلب ${stamp}`, password: 'TemporaryOrder123!', active: true, roleIds: [], overrides: { 'orders.view-assigned': true }, version: 0 }, 201);
    const other = await call('POST', '/manufacturing-orders', { code: `${prefix}-OTHER`, title: `طلب غير مسند ${stamp}`, machineId: machine.id, bomId: draft.id, responsibleId: session.user.id, deliveryAt: '2030-06-15T12:30:00Z', notes: '', version: 0 }, 201);
    await signIn(page, env.BOOTSTRAP_EMAIL, env.BOOTSTRAP_PASSWORD);
    await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'المخزن', exact: true }).click();
    const receive = async (serials: string[]) => {
      await page.getByRole('button', { name: 'استلام قطع', exact: true }).click();
      await page.getByLabel('الصنف', { exact: true }).selectOption(part.id);
      await page.getByLabel('الأرقام المسلسلة', { exact: true }).fill(serials.join('\n'));
      await page.getByLabel('الموقع بالمخزن', { exact: true }).fill('رف التجربة');
      await page.getByLabel('مرجع الاستلام', { exact: true }).fill(prefix);
      await page.setViewportSize({ width: 834, height: 1112 });
      await page.screenshot({ path: testInfo.outputPath('stock-receipt-tablet.png'), fullPage: true });
      await page.getByRole('button', { name: 'تأكيد الاستلام', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    };
    await receive([`${prefix}-S1`, `${prefix}-S2`]);
    await page.getByRole('link', { name: 'طلبات التصنيع', exact: true }).click();
    await page.getByRole('button', { name: 'طلب جديد', exact: true }).click();
    await page.getByLabel('كود الطلب', { exact: true }).fill(`${prefix}-UI`);
    await page.getByLabel('اسم الطلب', { exact: true }).fill(`تجهيز ماكينة ${stamp}`);
    await page.getByLabel('الماكينة', { exact: true }).selectOption(machine.id);
    await page.getByLabel('إصدار قطع الماكينة', { exact: true }).selectOption(draft.id);
    await page.getByLabel('المسؤول', { exact: true }).selectOption(worker.id);
    await page.getByLabel('موعد التسليم', { exact: true }).fill('2030-06-15T15:30');
    const expectedDue = await page.evaluate(() => new Date('2030-06-15T15:30').toISOString());
    await page.getByLabel('ملاحظات', { exact: true }).fill('تجهيز قطع الطلب التجريبي');
    for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 834, 1112], ['mobile', 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath(`order-form-${name}.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'حفظ المسودة', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: `تجهيز ماكينة ${stamp}`, exact: true })).toBeVisible();
    const orderUrl = page.url(), orderId = orderUrl.split('/').at(-1);
    const persisted = await call('GET', `/manufacturing-orders/${orderId}`);
    expect(new Date(persisted.deliveryAt).toISOString()).toBe(expectedDue);
    await expect(page.getByTestId('order-requirements').locator('tbody tr')).toHaveCount(2);
    await page.getByRole('button', { name: 'تعديل المسودة', exact: true }).click();
    await page.getByLabel('ملاحظات', { exact: true }).fill('ملاحظات المسودة المعدلة');
    await page.getByRole('button', { name: 'حفظ المسودة', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('ملاحظات المسودة المعدلة', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'فتح الطلب للعمل', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد فتح الطلب', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('مفتوح', { exact: true })).toBeVisible();
    await expect(page.locator('.order-warehouse').getByRole('checkbox')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'تعديل المسودة', exact: true })).toHaveCount(0);
    await page.reload(); await expect(page.getByTestId('order-requirements').locator('tbody tr')).toHaveCount(2);
    const warehouse = page.locator('.order-warehouse');
    await expect(warehouse.getByRole('checkbox')).toHaveCount(2);
    await warehouse.getByRole('button', { name: 'طلب تجهيز A2', exact: true }).click();
    await page.getByLabel('ملاحظات الحركة', { exact: true }).fill('تجهيز النقص التجريبي');
    await page.getByRole('button', { name: 'إرسال للتصنيع', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('link', { name: 'نواقص وتجهيز القطع', exact: true }).click();
    await page.getByLabel('بحث المخزن', { exact: true }).fill(`${prefix}-UI`);
    await page.getByRole('button', { name: 'بدء التجهيز', exact: true }).click();
    await expect(page.locator('tbody').getByText('قيد التجهيز', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('preparations-tablet.png'), fullPage: true });
    await page.getByRole('link', { name: 'المخزن', exact: true }).click();
    await receive([`${prefix}-S3`, `${prefix}-S4`]);
    await page.goto(orderUrl);
    await warehouse.getByRole('button', { name: 'حجز المتاح', exact: true }).click();
    await expect(warehouse.getByRole('checkbox')).toHaveCount(4);
    await expect(warehouse.getByText('مغطى بالمخزون', { exact: true })).toBeVisible();
    await warehouse.getByRole('checkbox', { name: `تحديد ${prefix}-S1`, exact: true }).check();
    await warehouse.getByRole('button', { name: 'صرف المحدد (1)', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد الصرف', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(warehouse.getByRole('button', { name: `إرجاع ${prefix}-S1`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).click();
    await page.getByLabel('سبب الإلغاء', { exact: true }).fill('محاولة قبل الإرجاع');
    await page.getByRole('button', { name: 'تأكيد إلغاء الطلب', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('أرجع جميع القطع المصروفة');
    await page.getByRole('button', { name: 'رجوع', exact: true }).click();
    await warehouse.getByRole('button', { name: `إرجاع ${prefix}-S1`, exact: true }).click();
    await page.getByLabel('حالة المرتجع', { exact: true }).selectOption('DEFECTIVE');
    await page.getByLabel('سبب الإرجاع', { exact: true }).fill('عيب يحتاج فحص');
    await page.getByRole('button', { name: 'تأكيد الإرجاع', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(warehouse.getByRole('checkbox')).toHaveCount(3);
    await page.getByRole('link', { name: 'المخزن', exact: true }).click();
    await page.getByRole('tab', { name: 'القطع المسلسلة', exact: true }).click();
    await page.getByLabel('بحث المخزن', { exact: true }).fill(`${prefix}-S1`);
    await expect(page.locator('tbody').getByText('معزول', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `إتاحة ${prefix}-S1 بعد الفحص`, exact: true }).click();
    await page.getByLabel('نتيجة الفحص', { exact: true }).fill('تم الإصلاح والفحص');
    await page.getByRole('button', { name: 'تأكيد الإتاحة', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto(orderUrl);
    await warehouse.getByRole('button', { name: 'حجز المتاح', exact: true }).click();
    await expect(warehouse.getByRole('checkbox')).toHaveCount(4);
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح', exact: true }).click();
      for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 834, 1112], ['mobile', 390, 844]] as const) {
        await page.setViewportSize({ width, height });
        for (const path of ['/orders', orderUrl, '/warehouse', '/preparations']) {
          await page.goto(path); await expect(page.locator('tbody tr').first()).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
          await page.screenshot({ path: testInfo.outputPath(`order-${path === orderUrl ? 'detail' : path.slice(1)}-${theme}-${name}.png`), fullPage: true });
        }
      }
    }
    workerContext = await browser.newContext({ baseURL }); const workerPage = await workerContext.newPage();
    await signIn(workerPage, email, 'TemporaryOrder123!');
    await expect(workerPage.getByRole('heading', { name: 'تغيير كلمة المرور', exact: true })).toBeVisible();
    await workerPage.getByLabel('كلمة المرور الحالية', { exact: true }).fill('TemporaryOrder123!');
    await workerPage.getByLabel('كلمة المرور الجديدة', { exact: true }).fill('ChangedOrder456!');
    await workerPage.getByLabel('تأكيد كلمة المرور', { exact: true }).fill('ChangedOrder456!');
    await workerPage.getByRole('button', { name: 'حفظ وتسجيل الدخول مجددًا', exact: true }).click();
    await expect(workerPage.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
    await signIn(workerPage, email, 'ChangedOrder456!');
    await workerPage.getByRole('link', { name: 'طلبات التصنيع', exact: true }).click();
    await expect(workerPage.locator('tbody tr')).toHaveCount(1);
    await expect(workerPage.locator('tbody')).toContainText(`${prefix}-UI`);
    await expect(workerPage.getByRole('button', { name: 'طلب جديد', exact: true })).toHaveCount(0);
    await workerPage.goto(orderUrl); await expect(workerPage.getByTestId('order-requirements').locator('tbody tr')).toHaveCount(2);
    await expect(workerPage.locator('.order-warehouse tbody').last().locator('tr')).toHaveCount(4);
    await workerPage.goto('/warehouse');
    await expect(workerPage.getByRole('heading', { name: 'غير مصرح بالدخول', exact: true })).toBeVisible();
    await expect(workerPage.getByRole('button', { name: 'إلغاء الطلب', exact: true })).toHaveCount(0);
    await workerPage.goto(`/orders/${other.id}`);
    await expect(workerPage.getByRole('alert')).toContainText('السجل غير موجود');
    await page.goto(orderUrl);
    await page.getByRole('button', { name: 'إلغاء الطلب', exact: true }).click();
    await expect(page.getByRole('button', { name: 'تأكيد إلغاء الطلب', exact: true })).toBeDisabled();
    await page.getByLabel('سبب الإلغاء', { exact: true }).fill('انتهاء اختبار المتصفح');
    await page.getByRole('button', { name: 'تأكيد إلغاء الطلب', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('ملغي', { exact: true })).toBeVisible();
    await expect(page.locator('.order-warehouse').getByText('لا توجد قطع مخصصة', { exact: true })).toBeVisible();
    await expect(page.getByTestId('order-requirements').locator('tbody tr')).toHaveCount(2);
    expect(errors).toEqual([]);
  } finally {
    await workerContext?.close();
    for (const order of await call('GET', '/manufacturing-orders')) if (order.code.startsWith(prefix) && order.status !== 'CANCELLED') {
      let stock = await call('GET', `/manufacturing-orders/${order.id}/stock`);
      for (const piece of stock.pieces.filter((p: { status: string }) => p.status === 'ISSUED')) stock = await call('POST', `/manufacturing-orders/${order.id}/stock/pieces/${piece.id}/return`, { version: stock.version, condition: 'GOOD', notes: 'E2E fixture return' });
      await call('POST', `/manufacturing-orders/${order.id}/cancel`, { version: stock.version, reason: 'E2E fixture cleanup' });
    }
    for (const endpoint of ['/machines', '/parts', '/machine-models']) for (const row of await call('GET', endpoint))
      if (row.active && (row.code ?? row.serialNumber).startsWith(prefix)) await call('PUT', `${endpoint}/${row.id}`, { ...row, active: false });
    for (const user of await call('GET', '/users')) if (user.email === email && user.active) await call('PUT', `/users/${user.id}`, { ...user, active: false });
    const freshCsrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
    expect((await context.post('/api/v1/auth/logout', { headers: { 'X-XSRF-TOKEN': freshCsrf } })).status()).toBe(204);
    await context.dispose();
  }
});
