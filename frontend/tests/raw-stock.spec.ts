import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
test('raw receipt, issue, return, cut preview, serialized output and reusable remnants', async ({ page, playwright }, info) => {
  const baseURL = process.env.EASYBACK_WEB_URL ?? 'http://localhost:5173';
  if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new Error('Raw-stock tests require localhost.');
  const prefix = `E2E-RAW-${Date.now()}`;
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
  const partIds: string[] = []; let modelId = '', machineId = '', orderId = '';
  try {
    const model = await call('POST', '/machine-models', { code: `${prefix}-M`, name: `موديل الخامات ${prefix}`, description: '', active: true, version: 0 }, 201); modelId = model.id;
    const part = async (suffix: string, shape: string, kind: string, stockUnit: string, lengthMm: number, widthMm: number | null, diameterMm: number | null) => {
      const p = await call('POST', '/parts', { code: `${prefix}-${suffix}`, name: `خامة أو قطعة ${suffix} ${prefix}`, description: '', kind, shape, stockUnit, lengthMm, widthMm, diameterMm, defaultInstallMinutes: kind === 'MEASURED_STOCK' ? 0 : 10, active: true, version: 0 }, 201);
      partIds.push(p.id); return p;
    };
    const plate = await part('PLATE', 'RECTANGULAR', 'SERIALIZED_PIECE', 'PIECE', 120, 60, null);
    const rod = await part('ROD', 'ROUND', 'SERIALIZED_PIECE', 'PIECE', 100, null, 20);
    const sheet = await part('SHEET', 'RECTANGULAR', 'MEASURED_STOCK', 'AREA', 300, 200, null);
    const bar = await part('BAR', 'ROUND', 'MEASURED_STOCK', 'LENGTH', 1000, null, 20);
    const machine = await call('POST', '/machines', { serialNumber: `${prefix}-MC`, modelId, name: `ماكينة الخامات ${prefix}`, location: '', notes: '', active: true, version: 0 }, 201); machineId = machine.id;
    const bom = await call('POST', `/machines/${machine.id}/boms`, {}, 201);
    for (const [version, positionCode, partId] of [[0, 'A1', plate.id], [1, 'A2', rod.id]] as const) await call('POST', `/boms/${bom.id}/items`, { positionCode, partId, quantity: 2, expectedInstallMinutes: 10, notes: '', version }, 201);
    await call('POST', `/boms/${bom.id}/publish`, { version: 2 });
    const order = await call('POST', '/manufacturing-orders', { code: `${prefix}-ORDER`, title: `قص الخامات ${prefix}`, machineId, bomId: bom.id, responsibleId: session.user.id, deliveryAt: '2030-07-20T12:00:00Z', notes: '', version: 0 }, 201); orderId = order.id;
    await call('POST', `/manufacturing-orders/${orderId}/release`, { version: 0 });
    for (const requirement of (await call('GET', `/manufacturing-orders/${orderId}/stock`)).requirements) {
      const current = await call('GET', `/manufacturing-orders/${orderId}/stock`);
      await call('POST', `/manufacturing-orders/${orderId}/stock/preparation`, { version: current.version, requirementId: requirement.requirementId, notes: 'تجهيز بالقص' });
    }
    const preparations = (await call('GET', '/warehouse/preparations')).filter((q: { orderId: string }) => q.orderId === orderId);
    for (const q of preparations) await call('POST', `/warehouse/preparations/${q.id}/start`, { version: q.version });
    const first = preparations.find((q: { positionCode: string }) => q.positionCode === 'A1');
    const second = preparations.find((q: { positionCode: string }) => q.positionCode === 'A2');
    await page.goto('/'); await page.getByLabel('البريد الإلكتروني', { exact: true }).fill(env.BOOTSTRAP_EMAIL); await page.getByLabel('كلمة المرور', { exact: true }).fill(env.BOOTSTRAP_PASSWORD); await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await page.getByRole('link', { name: 'الخامات والقص', exact: true }).click();
    const receive = async (partId: string, code: string, round: boolean) => {
      await page.getByRole('button', { name: 'استلام خامات', exact: true }).click();
      await page.getByLabel('صنف الخامة', { exact: true }).selectOption(partId);
      await page.getByLabel('أكواد وحدات الخامة', { exact: true }).fill(code);
      await page.getByLabel('الموقع بالمخزن', { exact: true }).fill('رف الخامات التجريبي');
      if (round) await expect(page.getByLabel('العرض الفعلي', { exact: true })).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(round ? 'raw-round-receipt.png' : 'raw-area-receipt.png'), fullPage: true });
      await page.getByRole('button', { name: 'تأكيد استلام الخامات', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    };
    await receive(sheet.id, `${prefix}-S1`, false); await receive(bar.id, `${prefix}-B1`, true);
    const search = async (text: string) => { await page.getByLabel('بحث المخزن', { exact: true }).fill(text); };
    await page.getByRole('tab', { name: 'أرصدة الخامات', exact: true }).click(); await search(sheet.code); await expect(page.locator('tbody')).toContainText('0.06 م²');
    const issue = async (code: string, preparation: string) => {
      await page.getByRole('tab', { name: 'الخامات والبواقي', exact: true }).click(); await search(code);
      await page.getByRole('button', { name: `صرف خامة ${code}`, exact: true }).click(); await page.getByLabel('طلب التجهيز', { exact: true }).selectOption(preparation);
      await page.getByRole('button', { name: 'تأكيد صرف الخامة', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.getByRole('button', { name: `قص ${code}`, exact: true })).toBeVisible();
    };
    await issue(`${prefix}-S1`, first.id);
    const blocked = await call('POST', `/manufacturing-orders/${orderId}/cancel`, { version: (await call('GET', `/manufacturing-orders/${orderId}`)).version, reason: 'Before return' }, 409); expect(blocked.code).toBe('RAW_RETURN_BEFORE_CANCEL');
    await page.getByRole('button', { name: `إرجاع خامة ${prefix}-S1`, exact: true }).click(); await page.getByLabel('سبب إرجاع الخامة', { exact: true }).fill('لم يتم القص بعد'); await page.getByRole('button', { name: 'تأكيد إرجاع الخامة', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await issue(`${prefix}-S1`, first.id);
    await page.getByRole('button', { name: `قص ${prefix}-S1`, exact: true }).click();
    await page.getByLabel('الأرقام المسلسلة الناتجة', { exact: true }).fill([1, 2, 3].map(n => `${prefix}-P${n}`).join('\n'));
    await page.getByRole('button', { name: 'معاينة القص', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('أكبر من النقص');
    await page.getByLabel('الأرقام المسلسلة الناتجة', { exact: true }).fill(`${prefix}-P1\n${prefix}-P2`); await page.getByLabel('عدد الأعمدة', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'معاينة القص', exact: true }).click(); await expect(page.getByRole('region', { name: 'معاينة القص', exact: true })).toContainText('0.0456 م²');
    for (const [name, width, height] of [['desktop', 1440, 900], ['tablet', 834, 1112], ['mobile', 390, 844]] as const) {
      await page.setViewportSize({ width, height });
      expect(await page.getByRole('dialog').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
      await page.screenshot({ path: info.outputPath(`cut-preview-${name}.png`), fullPage: true });
    }
    await page.getByLabel('ملاحظات الخامة', { exact: true }).fill('قص التجربة'); await expect(page.getByRole('button', { name: 'تأكيد القص والاستلام', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'معاينة القص', exact: true }).click(); await page.getByRole('button', { name: 'تأكيد القص والاستلام', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('tbody tr')).toHaveCount(3); await expect(page.locator('tbody').getByText('متاح', { exact: true })).toHaveCount(2);
    const stock = await call('GET', `/manufacturing-orders/${orderId}/stock`); expect(stock.pieces).toHaveLength(2); expect(stock.requirements.find((r: { positionCode: string }) => r.positionCode === 'A1').missing).toBe(0);
    await page.setViewportSize({ width: 834, height: 1112 }); await page.getByRole('button', { name: 'الوضع الداكن', exact: true }).click(); await page.screenshot({ path: info.outputPath('raw-remnants-dark-tablet.png'), fullPage: true });
    await issue(`${prefix}-B1`, second.id); await page.getByRole('button', { name: `قص ${prefix}-B1`, exact: true }).click(); await page.getByLabel('الأرقام المسلسلة الناتجة', { exact: true }).fill(`${prefix}-R1\n${prefix}-R2`);
    await expect(page.getByLabel('عدد الأعمدة', { exact: true })).toHaveCount(0); await page.getByRole('button', { name: 'معاينة القص', exact: true }).click(); await expect(page.getByRole('region', { name: 'معاينة القص', exact: true })).toContainText('0.8 م');
    await page.screenshot({ path: info.outputPath('raw-length-preview-dark.png'), fullPage: true }); await page.getByRole('button', { name: 'تأكيد القص والاستلام', exact: true }).click(); await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('tab', { name: 'سجل القص', exact: true }).click(); await search(prefix); await expect(page.locator('tbody tr')).toHaveCount(2); await expect(page.locator('tbody')).toContainText(`${prefix}-R1`);
    await page.getByRole('tab', { name: 'حركات الخامات', exact: true }).click(); await search(`${prefix}-S1`); await expect(page.locator('tbody')).toContainText('إرجاع دون قص'); await expect(page.locator('tbody')).toContainText('إرجاع باقي');
    await page.getByRole('tab', { name: 'أرصدة الخامات', exact: true }).click(); await search(sheet.code); await expect(page.locator('tbody')).toContainText('0.0456 م²');
    await page.setViewportSize({ width: 1440, height: 900 }); await page.getByRole('button', { name: 'الوضع الفاتح', exact: true }).click(); await page.screenshot({ path: info.outputPath('raw-balances-desktop.png'), fullPage: true });
    await page.goto(`/orders/${orderId}`); await expect(page.locator('.order-warehouse').getByRole('checkbox')).toHaveCount(4); await expect(page.locator('.order-warehouse').getByText('مغطى بالمخزون', { exact: true })).toHaveCount(2);
    expect(errors).toEqual([]);
  } finally {
    const units = await call('GET', '/warehouse/raw/units');
    for (const u of units.filter((u: UnitFixture) => partIds.includes(u.partId) && u.status === 'ISSUED')) await call('POST', `/warehouse/raw/units/${u.id}/return`, { version: u.version, notes: 'E2E cleanup; unused source' });
    if (orderId) { const o = await call('GET', `/manufacturing-orders/${orderId}`); if (o.status !== 'CANCELLED') await call('POST', `/manufacturing-orders/${orderId}/cancel`, { version: o.version, reason: 'E2E cleanup' }); }
    if (machineId) { const m = (await call('GET', '/machines')).find((m: { id: string }) => m.id === machineId); await call('PUT', `/machines/${machineId}`, { ...m, active: false }); }
    for (const id of partIds) { const p = (await call('GET', '/parts')).find((p: { id: string }) => p.id === id); await call('PUT', `/parts/${id}`, { ...p, active: false }); }
    if (modelId) { const m = (await call('GET', '/machine-models')).find((m: { id: string }) => m.id === modelId); await call('PUT', `/machine-models/${modelId}`, { ...m, active: false }); }
    const logoutCsrf = (await (await context.get('/api/v1/auth/csrf')).json()).token;
    expect((await context.post('/api/v1/auth/logout', { headers: { ...headers, 'X-XSRF-TOKEN': logoutCsrf } })).status()).toBe(204);
    await context.dispose();
  }
});
type UnitFixture = { id: string; partId: string; status: string; version: number };
