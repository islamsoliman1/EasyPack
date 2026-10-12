import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const sizes = [['desktop', 1440, 900], ['tablet', 834, 1112], ['mobile', 390, 844]] as const;

test.beforeEach(() => {
  const host = new URL(process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173').hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) throw new Error('Appearance tests are restricted to localhost development.');
});

async function setTheme(page: Page, theme: 'light' | 'dark') {
  if (await page.locator('html').getAttribute('data-theme') !== theme) {
    await page.getByRole('button', { name: theme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح', exact: true }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function checkAppearance(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  const brand = page.locator('.brand').first();
  await expect(brand.locator('strong')).toHaveText('EPE');
  expect(await brand.locator('img').evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBeTruthy();
  const ratios = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const luminance = (token: string) => {
      const hex = style.getPropertyValue(token).trim().slice(1);
      const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    };
    return [['--text', '--canvas'], ['--muted', '--canvas'], ['--muted', '--surface'], ['--brand-text', '--selected'], ['--success-text', '--success-bg'], ['--danger-text', '--danger-bg'], ['--role-text', '--role-bg']].map(([fg, bg]) => {
      const a = luminance(fg), b = luminance(bg);
      return { fg, bg, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    });
  });
  for (const pair of ratios) expect(pair.ratio, `${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(4.5);
}

test('brand, theme persistence and login layout at desktop, tablet and mobile sizes', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page).toHaveTitle('EasyPack | EPE');
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const [name, width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await checkAppearance(page);
      await page.screenshot({ path: testInfo.outputPath(`login-${theme}-${name}.png`), fullPage: true });
    }
  }
});

test('existing authenticated screens and forms remain readable in both themes', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failedRequests.push(`${r.request().method()} ${new URL(r.url()).pathname}: ${r.status()}`); });
  await page.goto('/');
  await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(env.BOOTSTRAP_EMAIL);
  await page.getByLabel('كلمة المرور', { exact: true }).fill(env.BOOTSTRAP_PASSWORD);
  await page.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
  for (const theme of ['light', 'dark'] as const) {
    await setTheme(page, theme);
    for (const [name, width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const path of ['/', '/users', '/roles']) {
        await page.goto(path);
        await expect(page.locator('.workspace h1')).toBeVisible();
        if (path !== '/') await expect(page.locator('tbody tr').first()).toBeVisible();
        await checkAppearance(page);
        await page.screenshot({ path: testInfo.outputPath(`${path === '/' ? 'profile' : path.slice(1)}-${theme}-${name}.png`), fullPage: true });
      }
      await page.getByRole('button', { name: 'دور جديد', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
      await expect(dialog.getByRole('button', { name: 'حفظ', exact: true })).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath(`role-form-${theme}-${name}.png`), fullPage: true });
      await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    }
  }
  const loggedOut = page.waitForResponse(r => r.url().endsWith('/api/v1/auth/logout') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  expect((await loggedOut).status()).toBe(204);
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors, failedRequests.join('\n')).toEqual([]);
});

test('blocked browser storage does not prevent rendering or theme switching', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'تسجيل الدخول' })).toBeVisible();
  await setTheme(page, 'dark');
  await checkAppearance(page);
});
