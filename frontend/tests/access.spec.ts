import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const temporary = 'PilotTemporary123!';
const changed = 'PilotChanged456!';
function requireLocalDevelopment() {
  const host = new URL(process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173').hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) throw new Error('These mutating browser tests are restricted to localhost development.');
}
test.beforeEach(requireLocalDevelopment);

test.afterAll(async ({ playwright }) => {
  requireLocalDevelopment();
  const context = await playwright.request.newContext({ baseURL: process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173' });
  try {
    const csrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
    const auth = await context.post('/api/v1/auth/login', { headers: { 'X-XSRF-TOKEN': csrf }, data: { email: env.BOOTSTRAP_EMAIL, password: env.BOOTSTRAP_PASSWORD } });
    expect(auth.status()).toBe(200);
    const headers = { Authorization: `Bearer ${(await auth.json()).accessToken}`, 'X-XSRF-TOKEN': csrf };
    const response = await context.get('/api/v1/users', { headers });
    expect(response.status()).toBe(200);
    const users = await response.json();
    for (const user of users) {
      if (user.active && /^(pilot|limited)-\d+@test\.easyback\.local$/.test(user.email)
        && ['عامل التجربة', 'مسؤول التعطيل التجريبي'].includes(user.displayName)) {
        const result = await context.put(`/api/v1/users/${user.id}`, { headers, data: {
          email: user.email, displayName: user.displayName, active: false,
          roleIds: user.roleIds, overrides: user.overrides, version: user.version,
        } });
        expect(result.status()).toBe(200);
      }
    }
    expect((await context.post('/api/v1/auth/logout', { headers })).status()).toBe(204);
  } finally { await context.dispose(); }
});
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).not.toBeVisible();
}
async function changePassword(page: Page, old: string, next: string) {
  await page.getByLabel('كلمة المرور الحالية', { exact: true }).fill(old);
  await page.getByLabel('كلمة المرور الجديدة', { exact: true }).fill(next);
  await page.getByLabel('تأكيد كلمة المرور', { exact: true }).fill(next);
  await page.getByRole('button', { name: 'حفظ وتسجيل الدخول مجددًا', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
}

test('real PostgreSQL access administration, worker restrictions, responsive layout', async ({ page, browser }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('pageerror', e => consoleErrors.push(e.message));
  let adminPassword = env.BOOTSTRAP_PASSWORD;
  const stamp = Date.now();
  const email = `pilot-${stamp}@test.easyback.local`;
  const roleName = `Pilot reader ${stamp}`;
  await signIn(page, env.BOOTSTRAP_EMAIL, adminPassword);
  await expect(page.getByRole('heading').first()).toBeVisible();
  // The initial generated password is restored at the end; no credentials enter the test output.
  if (await page.getByRole('heading', { name: 'تغيير كلمة المرور', exact: true }).isVisible()) {
    const next = `E2e-${randomUUID()}`;
    await changePassword(page, adminPassword, next); adminPassword = next;
    await signIn(page, env.BOOTSTRAP_EMAIL, adminPassword);
  }
  await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
  try {
    await page.getByRole('link', { name: 'الأدوار والصلاحيات', exact: true }).click();
    await page.getByRole('button', { name: 'دور جديد', exact: true }).click();
    await page.getByLabel('اسم الدور', { exact: true }).fill(roleName);
    await page.getByLabel('عرض المستخدمين', { exact: true }).check();
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByRole('cell', { name: roleName, exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'المستخدمون', exact: true }).click();
    await page.getByRole('button', { name: 'مستخدم جديد', exact: true }).click();
    await page.getByLabel('الاسم', { exact: true }).fill('عامل التجربة');
    await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email);
    await page.getByLabel('كلمة مرور مؤقتة', { exact: true }).fill(temporary);
    await page.getByRole('checkbox', { name: roleName, exact: true }).check();
    await page.getByRole('combobox', { name: 'عرض المستخدمين', exact: true }).selectOption('deny');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('textbox', { name: 'بحث المستخدمين' }).fill(email);
    await expect(page.getByRole('textbox', { name: 'بحث المستخدمين' })).toHaveValue(email);
    await expect(page.getByRole('cell').filter({ hasText: email })).toBeVisible();
    const workerContext = await browser.newContext({ baseURL: process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173' }); const worker = await workerContext.newPage();
    await signIn(worker, email, temporary);
    await expect(worker.getByRole('heading', { name: 'تغيير كلمة المرور', exact: true })).toBeVisible();
    await changePassword(worker, temporary, changed); await signIn(worker, email, changed);
    await expect(worker.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
    await expect(worker.getByRole('link', { name: 'المستخدمون', exact: true })).toHaveCount(0);
    await worker.goto('/users');
    await expect(worker.getByRole('heading', { name: 'غير مصرح بالدخول', exact: true })).toBeVisible();
    for (const path of ['/machine-models', '/parts', '/machines', '/boms']) {
      await worker.goto(path);
      await expect(worker.getByRole('heading', { name: 'غير مصرح بالدخول', exact: true })).toBeVisible();
    }
    const refreshedUsers = page.waitForResponse(r => r.url().endsWith('/api/v1/users') && r.request().method() === 'GET');
    await page.getByRole('button', { name: 'تحديث القائمة', exact: true }).click();
    expect((await refreshedUsers).status()).toBe(200);
    await expect(page.getByRole('row').filter({ hasText: email }).getByText('محدّثة', { exact: true })).toBeVisible();
    await page.getByRole('row').filter({ hasText: email }).getByRole('button', { name: 'تعديل عامل التجربة', exact: true }).click();
    await page.getByRole('checkbox', { name: 'حساب نشط', exact: true }).uncheck();
    const disabledUser = page.waitForResponse(r => r.url().includes('/api/v1/users/') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    expect((await disabledUser).status()).toBe(200);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: email }).getByText('معطل', { exact: true })).toBeVisible();
    await worker.reload(); await expect(worker.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
    await workerContext.close();
    await page.getByRole('textbox', { name: 'بحث المستخدمين' }).fill(env.BOOTSTRAP_EMAIL);
    await page.getByRole('button', { name: 'تعديل EasyBack Administrator', exact: true }).click();
    await page.getByRole('checkbox', { name: 'حساب نشط', exact: true }).uncheck();
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('يجب الإبقاء على مدير نشط');
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.getByRole('textbox', { name: 'بحث المستخدمين' }).fill('');
    for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 834, 1112], ['mobile', 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole('heading', { name: /المستخدمون/ })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      expect(await page.locator('.brand strong').evaluate(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) + 1)).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
    }
    expect(consoleErrors).toEqual([]);
  } finally {
    if (adminPassword !== env.BOOTSTRAP_PASSWORD) {
      await page.goto('/');
      await page.getByRole('button', { name: 'تغيير كلمة المرور', exact: true }).click();
      await changePassword(page, adminPassword, env.BOOTSTRAP_PASSWORD);
    }
  }
});

test('an account with only view and deactivate permissions can disable itself without editing identity or access', async ({ page, browser }) => {
  const email = `limited-${Date.now()}@test.easyback.local`;
  await signIn(page, env.BOOTSTRAP_EMAIL, env.BOOTSTRAP_PASSWORD);
  await page.getByRole('link', { name: 'المستخدمون', exact: true }).click();
  await page.getByRole('button', { name: 'مستخدم جديد', exact: true }).click();
  await page.getByLabel('الاسم', { exact: true }).fill('مسؤول التعطيل التجريبي');
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(email);
  await page.getByLabel('كلمة مرور مؤقتة', { exact: true }).fill(temporary);
  await page.getByRole('combobox', { name: 'عرض المستخدمين', exact: true }).selectOption('allow');
  await page.getByRole('combobox', { name: 'تفعيل وتعطيل المستخدم', exact: true }).selectOption('allow');
  await page.getByRole('button', { name: 'حفظ', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const context = await browser.newContext({ baseURL: process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173' });
  try {
    const limited = await context.newPage();
    await signIn(limited, email, temporary);
    await changePassword(limited, temporary, changed);
    await signIn(limited, email, changed);
    await limited.getByRole('link', { name: 'المستخدمون', exact: true }).click();
    await expect(limited.getByRole('button', { name: 'مستخدم جديد', exact: true })).toHaveCount(0);
    await limited.getByRole('textbox', { name: 'بحث المستخدمين' }).fill(email);
    await limited.getByRole('row').filter({ hasText: email }).getByRole('button', { name: 'تعديل مسؤول التعطيل التجريبي', exact: true }).click();
    await expect(limited.getByLabel('الاسم', { exact: true })).toHaveAttribute('readonly', '');
    await expect(limited.getByRole('combobox', { name: 'عرض المستخدمين', exact: true })).toHaveCount(0);
    await limited.getByRole('checkbox', { name: 'حساب نشط', exact: true }).uncheck();
    const update = limited.waitForResponse(r => r.url().includes('/api/v1/users/') && r.request().method() === 'PUT');
    await limited.getByRole('button', { name: 'حفظ', exact: true }).click();
    expect((await update).status()).toBe(200);
    await expect(limited.getByRole('heading', { name: 'تسجيل الدخول', exact: true })).toBeVisible();
  } finally { await context.close(); }
  await page.reload();
  await page.getByRole('textbox', { name: 'بحث المستخدمين' }).fill(email);
  await expect(page.getByRole('row').filter({ hasText: email }).getByText('معطل', { exact: true })).toBeVisible();
});
