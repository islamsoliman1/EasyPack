import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
test.beforeEach(() => {
  if (!['localhost', '127.0.0.1'].includes(new URL(process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173').hostname)) throw new Error('Catalog tests require localhost.');
});
async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('models, physical machines, both catalog kinds, repeated BOM positions, publication and next revision', async ({ page, playwright }, testInfo) => {
  const stamp = Date.now(), prefix = `E2E-CAT-${stamp}`, modelName = `موديل التجربة ${stamp}`, partName = `لوح التجربة ${stamp}`;
  const pageErrors: string[] = []; page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('/');
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(env.BOOTSTRAP_EMAIL);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(env.BOOTSTRAP_PASSWORD);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
  try {
    await page.getByRole('link', { name: 'موديلات الماكينات', exact: true }).click();
    for (const suffix of ['M1', 'M2']) {
      await page.getByRole('button', { name: 'موديل جديد', exact: true }).click();
      await page.getByLabel('كود الموديل', { exact: true }).fill(`${prefix}-${suffix}`);
      await page.getByLabel('اسم الموديل', { exact: true }).fill(`${modelName}-${suffix}`);
      await save(page);
    }
    await page.getByRole('link', { name: 'كتالوج القطع', exact: true }).click();
    await page.getByRole('button', { name: 'صنف جديد', exact: true }).click();
    await page.getByLabel('كود الصنف', { exact: true }).fill(`${prefix}-P1`);
    await page.getByLabel('اسم الصنف', { exact: true }).fill(partName);
    await page.getByLabel('الشكل', { exact: true }).selectOption('RECTANGULAR');
    await page.getByLabel('الطول (مم)', { exact: true }).fill('120.125');
    await page.getByLabel('العرض (مم)', { exact: true }).fill('60');
    await save(page);
    await page.getByRole('button', { name: 'صنف جديد', exact: true }).click();
    await page.getByLabel('كود الصنف', { exact: true }).fill(`${prefix}-RAW`);
    await page.getByLabel('اسم الصنف', { exact: true }).fill(`خامة التجربة ${stamp}`);
    await page.getByLabel('نوع الصنف', { exact: true }).selectOption('MEASURED_STOCK');
    await page.getByLabel('وحدة المخزون', { exact: true }).selectOption('AREA');
    await page.getByLabel('الطول (مم)', { exact: true }).fill('2000');
    await page.getByLabel('العرض (مم)', { exact: true }).fill('1000');
    await save(page);
    await page.getByRole('link', { name: 'الماكينات', exact: true }).click();
    await page.getByRole('button', { name: 'ماكينة جديدة', exact: true }).click();
    await page.getByLabel('رقم الماكينة', { exact: true }).fill(`${prefix}-MC1`);
    await page.getByLabel('اسم الماكينة', { exact: true }).fill(`ماكينة التجربة ${stamp}`);
    await page.getByLabel('الموديل', { exact: true }).selectOption({ label: `${prefix}-M1 · ${modelName}-M1` });
    await page.getByLabel('الموقع', { exact: true }).fill('صالة التجربة');
    await save(page);
    await page.getByRole('link', { name: 'قوائم المكونات', exact: true }).click();
    await page.getByLabel('الموديل', { exact: true }).selectOption({ label: `${prefix}-M1 · ${modelName}-M1` });
    await page.getByRole('button', { name: 'مسودة جديدة', exact: true }).click();
    await expect(page.getByText('لا توجد مكونات', { exact: true })).toBeVisible();
    for (const position of ['A-01', 'A-02']) {
      await page.getByRole('button', { name: 'إضافة مكون', exact: true }).click();
      await expect(page.getByLabel('القطعة', { exact: true }).locator('option').filter({ hasText: `${prefix}-RAW` })).toHaveCount(0);
      await page.getByLabel('كود الموضع', { exact: true }).fill(position);
      await page.getByLabel('القطعة', { exact: true }).selectOption({ label: `${prefix}-P1 · ${partName}` });
      if (position === 'A-01') {
        await page.getByLabel('الكمية', { exact: true }).fill('2');
        await page.getByLabel('وحدة الزمن', { exact: true }).selectOption('hours');
        await page.getByLabel('زمن التركيب لكل قطعة', { exact: true }).fill('0.5');
      }
      await save(page);
    }
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('tbody tr').filter({ hasText: 'A-01' }).getByRole('cell', { name: '30', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'تعديل الموضع A-02', exact: true }).click();
    await page.getByLabel('ملاحظات', { exact: true }).fill('موضع مكرر لنفس القطعة');
    await save(page);
    await page.getByRole('button', { name: 'حذف الموضع A-02', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد الحذف', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByRole('button', { name: 'نشر الإصدار', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد النشر', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'إضافة مكون', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'تعديل الموضع A-01', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'مسودة جديدة', exact: true }).click();
    await expect(page.getByRole('button', { name: 'إضافة مكون', exact: true })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.getByLabel('الإصدار', { exact: true })).toContainText('الإصدار 2');
    await page.getByLabel('الإصدار', { exact: true }).selectOption({ label: 'الإصدار 1 · منشور' });
    await expect(page.getByRole('button', { name: 'إضافة مكون', exact: true })).toHaveCount(0);
    await page.getByLabel('الموديل', { exact: true }).selectOption({ label: `${prefix}-M2 · ${modelName}-M2` });
    await page.getByRole('button', { name: 'مسودة جديدة', exact: true }).click();
    await page.getByRole('button', { name: 'إضافة مكون', exact: true }).click();
    await page.getByLabel('كود الموضع', { exact: true }).fill('B-01');
    await page.getByLabel('القطعة', { exact: true }).selectOption({ label: `${prefix}-P1 · ${partName}` });
    await save(page);
    const bomUrl = page.url();
    await page.getByRole('link', { name: 'كتالوج القطع', exact: true }).click();
    await page.getByRole('button', { name: 'صنف جديد', exact: true }).click();
    await page.getByLabel('كود الصنف', { exact: true }).fill(`${prefix}-LINK`);
    await page.getByLabel('اسم الصنف', { exact: true }).fill(`قطعة مرتبطة ${stamp}`);
    await page.getByLabel('ربط بمسودة موديل', { exact: true }).selectOption({ label: `${prefix}-M1 · ${modelName}-M1` });
    await page.getByLabel('كود الموضع', { exact: true }).fill('LINK-01');
    await page.getByLabel('الكمية', { exact: true }).fill('4');
    await page.setViewportSize({ width: 834, height: 1112 });
    await page.screenshot({ path: testInfo.outputPath('linked-part-tablet.png'), fullPage: true });
    await save(page);
    await page.getByRole('link', { name: 'قوائم المكونات', exact: true }).click();
    await page.getByLabel('الموديل', { exact: true }).selectOption({ label: `${prefix}-M1 · ${modelName}-M1` });
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('tbody tr').filter({ hasText: 'LINK-01' })).toContainText(`قطعة مرتبطة ${stamp}`);
    await page.getByRole('link', { name: 'الماكينات', exact: true }).click();
    await page.getByLabel('بحث الماكينات', { exact: true }).fill(`${prefix}-MC1`);
    await page.locator('tbody tr').filter({ hasText: `${prefix}-MC1` }).getByRole('link', { name: 'قطع الماكينة', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'قطع الماكينة', exact: true })).toBeVisible();
    await page.getByLabel('مصدر القائمة', { exact: true }).selectOption({ label: 'نسخة من الموديل · الإصدار 1' });
    await page.getByRole('button', { name: 'مسودة جديدة', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).not.toContainText('LINK-01');
    await page.getByRole('button', { name: 'إضافة مكون', exact: true }).click();
    await page.getByLabel('كود الموضع', { exact: true }).fill('MACHINE-ONLY');
    await page.getByLabel('القطعة', { exact: true }).selectOption({ label: `${prefix}-LINK · قطعة مرتبطة ${stamp}` });
    await save(page);
    await expect(page.locator('tbody tr')).toHaveCount(2);
    const machineUrl = page.url();
    await page.reload();
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await page.getByRole('button', { name: 'تعديل الموضع MACHINE-ONLY', exact: true }).click();
    await page.getByLabel('الكمية', { exact: true }).fill('3');
    await save(page);
    await expect(page.locator('tbody tr').filter({ hasText: 'MACHINE-ONLY' }).getByRole('cell', { name: '3', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'نشر الإصدار', exact: true }).click();
    await page.getByRole('button', { name: 'تأكيد النشر', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('link', { name: 'قوائم المكونات', exact: true }).click();
    await page.getByLabel('الموديل', { exact: true }).selectOption({ label: `${prefix}-M1 · ${modelName}-M1` });
    await expect(page.locator('tbody tr')).toHaveCount(2);
    await expect(page.locator('tbody')).not.toContainText('MACHINE-ONLY');
    await page.getByLabel('الإصدار', { exact: true }).selectOption({ label: 'الإصدار 1 · منشور' });
    await expect(page.locator('tbody tr')).toHaveCount(1);
    for (const theme of ['light', 'dark'] as const) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: theme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح', exact: true }).click();
      for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 834, 1112], ['mobile', 390, 844]] as const) {
        await page.setViewportSize({ width, height });
        for (const path of ['/machine-models', '/parts', '/machines', bomUrl, machineUrl]) {
          await page.goto(path);
          await expect(page.locator('tbody tr').first()).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
          await page.screenshot({ path: testInfo.outputPath(`${path === machineUrl ? 'machine-parts' : path.startsWith('http') ? 'boms' : path.slice(1)}-${theme}-${name}.png`), fullPage: true });
        }
      }
    }
    await page.goto('/parts');
    await page.getByLabel('بحث كتالوج القطع', { exact: true }).fill(`${prefix}-P1`);
    await page.getByRole('button', { name: `تعديل ${partName}`, exact: true }).click();
    for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 834, 1112], ['mobile', 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      const dialog = page.getByRole('dialog');
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath(`part-form-${name}.png`), fullPage: true });
      await dialog.getByRole('button', { name: 'حفظ', exact: true }).scrollIntoViewIfNeeded();
      await expect(dialog.getByRole('button', { name: 'حفظ', exact: true })).toBeInViewport();
    }
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    expect(pageErrors).toEqual([]);
  } finally {
    const context = await playwright.request.newContext({ baseURL: process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173' });
    try {
      const csrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
      const login = await context.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': csrf }, data: { email: env.BOOTSTRAP_EMAIL, password: env.BOOTSTRAP_PASSWORD } });
      expect(login.status()).toBe(200);
      const headers = { Authorization: `Bearer ${(await login.json()).accessToken}`, 'X-XSRF-TOKEN': csrf };
      for (const endpoint of ['/machines', '/parts', '/machine-models']) {
        const response = await context.get(`/api/v1${endpoint}`, { headers }); expect(response.status()).toBe(200);
        for (const row of await response.json()) {
          if (row.active && (row.code ?? row.serialNumber).startsWith(prefix + '-')) {
            expect((await context.put(`/api/v1${endpoint}/${row.id}`, { headers, data: { ...row, active: false } })).status()).toBe(200);
          }
        }
      }
      const freshCsrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
      expect((await context.post('/api/v1/auth/logout', { headers: { 'X-XSRF-TOKEN': freshCsrf } })).status()).toBe(204);
    } finally { await context.dispose(); }
  }
});
