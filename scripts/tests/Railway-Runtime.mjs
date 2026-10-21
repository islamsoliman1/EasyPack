import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Disposable local rehearsal only: never reads .env or connects to existing databases.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { request, chromium, expect } = createRequire(join(root, 'frontend/package.json'))('@playwright/test');
const id = `easyback-railway-test-${randomUUID().slice(0, 8)}`;
const names = { db: `${id}-db`, app: `${id}-app`, tls: `${id}-tls` };
const directory = join(root, '.local', id);
const origin = 'https://localhost:18443';
// HTTPS API checks remain separate; antivirus blocks the local self-signed browser certificate.
const browserOrigin = 'http://localhost:18780';
const appImage = process.env.EASYBACK_RAILWAY_IMAGE ?? 'easyback-railway:demo';
const password = `Initial-${randomBytes(18).toString('hex')}!`;
const changed = `Changed-${randomBytes(18).toString('hex')}!`;
const environment = {
  ...process.env, POSTGRES_PASSWORD: randomBytes(32).toString('hex'),
  POSTGRES_DB: 'railway_test', POSTGRES_USER: 'railway_test',
  PORT: '8087', DB_USER: 'railway_test',
  DB_URL: 'jdbc:postgresql://db:5432/railway_test',
  JWT_SECRET: randomBytes(64).toString('hex'),
  ALLOWED_ORIGINS: `${origin},${browserOrigin}`, BOOTSTRAP_EMAIL: 'owner@railway-test.example.invalid',
  BOOTSTRAP_PASSWORD: password,
};
environment.DB_PASSWORD = environment.POSTGRES_PASSWORD;
const created = new Set();
let networkCreated = false;
let client;
const docker = (...args) => execFileSync('docker', args, {
  env: environment, encoding: 'utf8', timeout: 180000, stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function run(name, args) {
  docker('run', '-d', '--name', name, '--label', 'easyback.test=railway-runtime', '--network', id, ...args);
  created.add(name);
}
function startApp(bootstrap) {
  environment.BOOTSTRAP_PASSWORD = bootstrap ? password : '';
  environment.BOOTSTRAP_EMAIL = bootstrap ? 'owner@railway-test.example.invalid' : '';
  const keys = ['PORT', 'DB_URL', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET', 'ALLOWED_ORIGINS', 'BOOTSTRAP_EMAIL', 'BOOTSTRAP_PASSWORD'];
  run(names.app, ['--network-alias', 'app', '--memory', '512m', '--memory-swap', '512m',
    ...keys.flatMap(key => ['--env', key]), appImage]);
}
async function ready() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await client.get('/actuator/health/readiness', { timeout: 3000 });
      if (response.status() === 200) return;
    } catch { /* The isolated app/proxy may still be starting. */ }
    const state = JSON.parse(docker('inspect', '--format', '{{json .State}}', names.app));
    assert.equal(state.Running, true, 'Rehearsal app exited before readiness.');
    await delay(1000);
  }
  throw new Error('Rehearsal app did not reach database readiness.');
}
async function status(response, expected) {
  assert.equal(response.status(), expected, `${response.url()} returned ${response.status()}, expected ${expected}`);
  return response;
}
async function csrf() { return (await (await status(await client.get('/api/v1/auth/csrf'), 200)).json()).token; }
async function login(secret) {
  const response = await status(await client.post('/api/v1/auth/login', {
    headers: { 'X-XSRF-TOKEN': await csrf() }, data: { email: 'owner@railway-test.example.invalid', password: secret },
  }), 200);
  const cookie = response.headersArray().find(header => header.name.toLowerCase() === 'set-cookie' && header.value.startsWith('EB_REFRESH='));
  assert.ok(cookie && /Secure/i.test(cookie.value) && /HttpOnly/i.test(cookie.value) && /SameSite=Strict/i.test(cookie.value));
  return (await response.json()).accessToken;
}
function memory() {
  const peak = Number(docker('exec', names.app, 'cat', '/sys/fs/cgroup/memory.peak'));
  assert.ok(peak < 512 * 1024 * 1024, 'Memory reached the container limit.');
  assert.equal(JSON.parse(docker('inspect', '--format', '{{json .State.OOMKilled}}', names.app)), false);
  return Math.round(peak / 1024 / 1024);
}
try {
  for (const image of ['postgres:17-alpine', appImage, 'easyback-web:pilot']) docker('image', 'inspect', image);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'Caddyfile'), 'https://localhost {\n tls internal\n reverse_proxy app:8087\n}\nhttp://localhost {\n reverse_proxy app:8087\n}\n');
  docker('network', 'create', id); networkCreated = true;
  run(names.db, ['--network-alias', 'db', '--env', 'POSTGRES_DB', '--env', 'POSTGRES_USER', '--env', 'POSTGRES_PASSWORD', 'postgres:17-alpine']);
  startApp(true);
  run(names.tls, ['--publish', '127.0.0.1:18443:443', '--publish', '127.0.0.1:18780:80', '--mount', `type=bind,source=${join(directory, 'Caddyfile')},target=/etc/caddy/Caddyfile,readonly`, 'easyback-web:pilot']);
  client = await request.newContext({ baseURL: origin, ignoreHTTPSErrors: true });
  await ready();
  assert.equal(docker('inspect', '--format', '{{.Config.User}}', names.app), '10001:10001');
  assert.equal(Number(docker('inspect', '--format', '{{.HostConfig.Memory}}', names.app)), 512 * 1024 * 1024);
  const paths = ['/', '/index.html', '/users', '/roles', '/machine-models', '/parts', '/machines', '/boms',
    '/orders', '/warehouse', '/preparations', '/raw-stock', '/tasks', '/defects', '/operations',
    '/operations/templates', '/shifts', '/reports', '/notifications', `/orders/${randomUUID()}`,
    `/operations/${randomUUID()}`, `/machines/${randomUUID()}/assembly`];
  for (const path of paths) {
    const get = await status(await client.get(path), 200);
    assert.match(get.headers()['content-type'], /text\/html/);
    const head = await status(await client.head(path), 200);
    assert.equal((await head.body()).length, 0);
    assert.equal(head.headers()['content-length'], get.headers()['content-length']);
  }
  const page = await client.get('/');
  const headers = page.headers();
  for (const name of ['strict-transport-security', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'permissions-policy']) assert.ok(headers[name], `${name} missing`);
  const html = await page.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1]);
  assert.ok(assets.length >= 2, 'Built JS/CSS missing');
  for (const path of [...assets, '/brand-mark.svg']) await status(await client.get(path), 200);
  for (const path of ['/assets/missing.js', '/api/v1/unknown', '/api/unknown', '/unknown', '/orders/not-a-uuid', '/.env', '/error', '/actuator/env', '/actuator/info', '/v3/api-docs', '/swagger-ui/index.html']) {
    const response = await client.get(path);
    assert.ok(response.status() >= 400, `Unexpected public path ${path}`);
    assert.ok(!(await response.text()).includes('<!doctype html>'), `SPA swallowed ${path}`);
  }
  for (const path of ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout']) await status(await client.post(path), 403);
  for (const path of ['/api/v1/notifications', '/api/v1/notifications/unread-count']) await status(await client.get(path), 401);
  await status(await client.get('/api/v1/auth/csrf', { headers: { Origin: 'https://untrusted.example.invalid' } }), 403);
  let token = await login(password);
  await status(await client.get('/api/v1/machine-models', { headers: { Authorization: `Bearer ${token}` } }), 403);
  await status(await client.post('/api/v1/auth/password', {
    headers: { Authorization: `Bearer ${token}`, 'X-XSRF-TOKEN': await csrf() }, data: { currentPassword: password, newPassword: changed },
  }), 204);
  token = await login(changed);
  const model = await (await status(await client.post('/api/v1/machine-models', {
    headers: { Authorization: `Bearer ${token}`, 'X-XSRF-TOKEN': await csrf() },
    data: { code: 'RAILWAY-TEST', name: 'Synthetic rehearsal model', description: '', active: true, version: 0 },
  }), 201)).json();
  const part = await (await status(await client.post('/api/v1/parts', {
    headers: { Authorization: `Bearer ${token}`, 'X-XSRF-TOKEN': await csrf() },
    data: { code: 'RAILWAY-PART', name: 'Synthetic part', description: '', kind: 'SERIALIZED_PIECE', shape: 'STANDARD', stockUnit: 'PIECE', defaultInstallMinutes: 5, active: true, version: 0 },
  }), 201)).json();
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(10 * 1024 * 1024 - 32, 32), Buffer.from('\n%%EOF\n')]);
  const attachment = await (await status(await client.post(`/api/v1/files?kind=PART&targetId=${part.id}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-XSRF-TOKEN': await csrf() },
    multipart: { file: { name: 'synthetic-memory-fixture.pdf', mimeType: 'application/pdf', buffer: pdf } },
  }), 201)).json();
  // A metadata list must stay small even when its resource owns about 210 MiB of files.
  for (let index = 0; index < 20; index++) {
    const bytes = Buffer.from(pdf); bytes[100] = 65 + index;
    await status(await client.post(`/api/v1/files?kind=PART&targetId=${part.id}`, {
      headers: { Authorization: `Bearer ${token}`, 'X-XSRF-TOKEN': await csrf() },
      multipart: { file: { name: `large-metadata-fixture-${index}.pdf`, mimeType: 'application/pdf', buffer: bytes } },
    }), 201);
  }
  const metadata = await status(await client.get(`/api/v1/files?kind=PART&targetId=${part.id}`, { headers: { Authorization: `Bearer ${token}` } }), 200);
  const metadataBytes = (await metadata.body()).length;
  assert.equal((await metadata.json()).length, 21); assert.ok(metadataBytes < 12000);
  const report = '/api/v1/reports?from=2026-01-01&to=2026-12-31';
  for (let round = 0; round < 3; round++) {
    await Promise.all(Array.from({ length: 6 }, (_, i) => client.get(i % 2 ? report : `/api/v1/files/${attachment.id}`, { headers: { Authorization: `Bearer ${token}` } }).then(response => status(response, 200))));
  }
  const browser = await chromium.launch({ channel: 'msedge' });
  let browserPage;
  const browserErrors = [];
  try {
    const context = await browser.newContext({ baseURL: browserOrigin });
    const page = await context.newPage();
    browserPage = page;
    page.on('pageerror', error => browserErrors.push(error.message));
    await page.goto('/shifts');
    await page.getByLabel('البريد الإلكتروني', { exact: true }).fill('owner@railway-test.example.invalid');
    await page.getByLabel('كلمة المرور', { exact: true }).fill(changed);
    await page.getByRole('button', { name: 'دخول', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'حسابي', exact: true })).toBeVisible();
    await page.goto('/shifts');
    await expect(page.getByRole('heading', { name: 'الورديات والاستراحات', exact: true })).toBeVisible();
    const screenshots = join(root, 'output/playwright');
    mkdirSync(screenshots, { recursive: true });
    for (const [width, height] of [[1440, 900], [834, 1112]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/reports');
      await expect(page.getByRole('heading', { name: 'متابعة المصنع والتقارير', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'متابعة المصنع والتقارير', exact: true })).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal page overflow');
      assert.ok(await page.locator('img[src="/brand-mark.svg"]').first().evaluate(image => image.complete && image.naturalWidth > 0), 'Brand image did not render');
      await page.screenshot({ path: join(screenshots, `railway-browser-${width}.png`), fullPage: true });
      await page.goto('/notifications');
      await expect(page.getByRole('heading', { name: 'الإشعارات', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'الإشعارات', exact: true })).toBeVisible();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Notification page overflow');
      await page.screenshot({ path: join(screenshots, `railway-notifications-${width}.png`), fullPage: true });
    }
    assert.deepEqual(browserErrors, []);
    await context.close();
  } catch (error) {
    const screenshots = join(root, 'output/playwright');
    mkdirSync(screenshots, { recursive: true });
    if (browserPage) await browserPage.screenshot({ path: join(screenshots, 'railway-browser-failure.png'), fullPage: true });
    console.error(JSON.stringify({ browserErrors }));
    throw error;
  } finally { await browser.close(); }
  const firstPeak = memory();
  const refreshed = await status(await client.post('/api/v1/auth/refresh', { headers: { 'X-XSRF-TOKEN': await csrf() } }), 200);
  token = (await refreshed.json()).accessToken;
  await status(await client.post('/api/v1/auth/logout', { headers: { 'X-XSRF-TOKEN': await csrf() } }), 204);
  await status(await client.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } }), 401);
  docker('rm', '-f', '-v', names.app); created.delete(names.app);
  startApp(false);
  await ready();
  token = await login(changed);
  const models = await (await status(await client.get('/api/v1/machine-models', { headers: { Authorization: `Bearer ${token}` } }), 200)).json();
  assert.ok(models.some(item => item.id === model.id));
  const restored = await status(await client.get(`/api/v1/files/${attachment.id}`, { headers: { Authorization: `Bearer ${token}` } }), 200);
  assert.ok((await restored.body()).equals(pdf), 'Attachment bytes changed after app recreation');
  console.log(JSON.stringify({ passed: true, routes: paths.length, nonRoot: true, runtimeLimitMiB: 512, firstPeakMiB: firstPeak,
    restartedPeakMiB: memory(), https: true, secureCookies: true, csrf: true, bootstrapRetired: true,
    persistedModel: true, persistedAttachmentBytes: pdf.length, browserLoginAndReload: true,
    desktopTablet: true, notificationDirectReload: true, metadataAttachments: 21, metadataBytes,
    browserTransport: 'loopback-http', publicRailwayTested: false }));
} finally {
  if (client) await client.dispose();
  for (const name of [...created].reverse()) {
    try { docker('rm', '-f', '-v', name); } catch { console.error(`Cleanup failed for owned test container ${name}`); }
  }
  if (networkCreated) { try { docker('network', 'rm', id); } catch { console.error(`Cleanup failed for owned test network ${id}`); } }
  if (dirname(directory) === join(root, '.local') && directory.startsWith(join(root, '.local', 'easyback-railway-test-'))) rmSync(directory, { recursive: true, force: true });
}
