// Real-browser end-to-end test for the favicon status dot.
//
// Loads test/browser/fixture.html (a stand-in for the DSH browser kernel that
// captures the bundle registration and exposes a controllable `sessions`
// service), then drives conversation state and asserts what the plugin renders.
//
// Locally (uses an installed Chrome/Edge, no browser download):
//   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --no-save --no-package-lock playwright
//   PW_CHANNEL=msedge node test/browser.e2e.mjs
//
// In CI (bundled Chromium):
//   npm install --no-save --no-package-lock playwright
//   npx playwright install --with-deps chromium
//   node test/browser.e2e.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)); // <repo>/test
const ROOT = dirname(HERE); // repository root (holds lib/, test/)

const NEUTRAL = '64748b';
const GREEN = '4ade80';
const BLUE = '60a5fa';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/favicon.ico') { res.writeHead(204).end(); return; } // browsers auto-request it
      const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
      const file = join(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let playwright;
try {
  playwright = await import('playwright');
} catch (err) {
  console.error('playwright is not installed; see the header of this file for the install command');
  throw err;
}

const server = await startStaticServer();
const base = `http://127.0.0.1:${server.address().port}`;
const channel = process.env.PW_CHANNEL || undefined; // e.g. 'msedge' or 'chrome' locally

const browser = await playwright.chromium.launch(channel ? { channel } : {});
const page = await browser.newPage();

const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(String(err)));
const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

const fixtureUrl = `${base}/test/browser/fixture.html`;
const results = [];
function pass(name) { results.push(name); console.log(`  ok  ${name}`); }

async function reload() {
  await page.goto(fixtureUrl, { waitUntil: 'load' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'load' });
}

/** Simulate a list-store publish; `unreadExtra` mirrors the runtime's `completed` flag. */
async function publish(byId, current) {
  await page.evaluate(([byIdArg, currentArg]) => {
    const ids = Object.keys(byIdArg);
    window.__dshHarness.setSnapshot({ ids, byId: byIdArg, current: currentArg ?? undefined, phase: 'ready' });
  }, [byId, current ?? null]);
}

/** Simulate the runtime's pending-interaction source (DSH 0.1.5+ layout). */
async function setPending(entries) {
  await page.evaluate((e) => window.__dshHarness.setPending(e), entries);
}

async function setHidden(hidden) {
  await page.evaluate((h) => {
    if (window.__hiddenInstalled !== true) {
      window.__hiddenFlag = false;
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hiddenFlag === true });
      window.__hiddenInstalled = true;
    }
    window.__hiddenFlag = h;
  }, hidden);
}

const favicon = () => page.evaluate(() => window.__dshHarness.faviconHref());
const title = () => page.evaluate(() => window.__dshHarness.title());

/** Everything needed to understand a failure from the CI log alone. */
async function diagnostics() {
  try {
    return await page.evaluate(() => ({
      favicon: window.__dshHarness.faviconHref(),
      title: document.title,
      unread: (() => { try { return localStorage.getItem('dsh.tab-status-dot.unread.v1'); } catch { return '<blocked>'; } })(),
      harness: window.__dshHarness.debug ? window.__dshHarness.debug() : undefined
    }));
  } catch (err) {
    return { diagnosticsUnavailable: String(err) };
  }
}

async function waitFor(predicate, { timeout = 8000, step = 100, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  for (;;) {
    last = await predicate();
    if (last) return last;
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${label} (last value: ${JSON.stringify(last)}; state: ${JSON.stringify(await diagnostics())})`);
    }
    await sleep(step);
  }
}

const expectsColor = (href, color) => typeof href === 'string' && href.includes(color);

// ── 1. bundle loads, plugin applies, neutral dot, title untouched ───────────
await reload();
assert.equal(await page.evaluate(() => window.__dshHarness.registered()), true, 'bundle must register with __ModuleLoader__');
assert.equal(await page.evaluate(() => window.__dshHarness.registeredId()), '@pxy/dsh-tab-status-dot');
const inject = await page.evaluate(() => window.__dshHarness.apply());
assert.ok(Array.isArray(inject) && inject.includes('sessions'), 'bundle must declare its required services');
pass('bundle registers, exposes apply/inject, applies without throwing');

await publish({ a: { id: 'a', running: true } }, undefined);
await waitFor(async () => expectsColor(await favicon(), NEUTRAL), { label: 'neutral favicon' });
assert.equal(await title(), 'DeepSeek Harness', 'the page title must never be modified');
pass('running session → neutral dot, page title untouched');

// ── 2. a session finishes while not open → light green ─────────────────────
await publish({ a: { id: 'a', running: false } }, undefined);
await waitFor(async () => expectsColor(await favicon(), GREEN), { label: 'green favicon' });
pass('finished while not selected → light-green dot');

// ── 3. opening that session clears it ──────────────────────────────────────
await publish({ a: { id: 'a', running: false } }, 'a');
await waitFor(async () => expectsColor(await favicon(), NEUTRAL), { label: 'neutral after opening' });
pass('opening the session clears the reminder');

// ── 4. the OPEN session finishing while the tab is hidden also lights up ───
await setHidden(true);
await publish({ a: { id: 'a', running: true } }, 'a');
await publish({ a: { id: 'a', running: false } }, 'a');
await waitFor(async () => expectsColor(await favicon(), GREEN), { label: 'green after hidden-tab finish' });
pass('open session finishing while the tab is hidden → light-green dot');

// ── 5. ...and clears itself ~1 s after returning to the page ───────────────
await setHidden(false);
await waitFor(async () => expectsColor(await favicon(), NEUTRAL), { timeout: 5000, label: 'dwell auto-clear' });
pass('returning to the page clears it automatically (read-dwell)');

// ── 6. a waiting choice → light blue, cleared once answered ────────────────
// Driven through the runtime's pending-interaction source (the DSH 0.1.5+
// layout: `uiSession.pendingInteractions`), not a session-summary field.
await publish({ a: { id: 'a', running: false } }, 'a');
await setPending([['a', { key: 'q1', sessionId: 'a' }]]);
await waitFor(async () => expectsColor(await favicon(), BLUE), { label: 'blue favicon' });
pass('session waiting for a choice → light-blue dot (pending source)');
await setPending([]);
await waitFor(async () => expectsColor(await favicon(), NEUTRAL), { label: 'neutral after answering' });
pass('answering the choice clears the blue dot');

// ── 7. both conditions → two separate dots ─────────────────────────────────
await setPending([['c', { key: 'q2', sessionId: 'c' }]]);
await publish({ b: { id: 'b', running: true }, c: { id: 'c', running: false } }, 'c');
await publish({ b: { id: 'b', running: false }, c: { id: 'c', running: false } }, 'c');
const both = await waitFor(async () => {
  const href = await favicon();
  return expectsColor(href, GREEN) && expectsColor(href, BLUE) ? href : null;
}, { label: 'two-dot favicon' });
assert.ok(expectsColor(both, GREEN) && expectsColor(both, BLUE));
pass('finished-unviewed + awaiting-choice → two separate dots');
await setPending([]);

// ── 8. unviewed completions survive a page reload (localStorage) ───────────
await publish({ d: { id: 'd', running: true } }, 'c');
await publish({ d: { id: 'd', running: false } }, 'c');
await waitFor(async () => expectsColor(await favicon(), GREEN), { label: 'green before reload' });
await page.reload({ waitUntil: 'load' });
await page.evaluate(() => window.__dshHarness.apply());
await publish({ d: { id: 'd', running: false } }, 'c');
await waitFor(async () => expectsColor(await favicon(), GREEN), { label: 'green restored after reload' });
pass('unviewed completion is restored after a page reload');

// ── 9. disposal removes the favicon and leaves the title alone ─────────────
await page.evaluate(() => window.__dshHarness.dispose());
const afterDispose = await page.evaluate(() => ({
  favicon: window.__dshHarness.faviconHref(),
  title: document.title
}));
assert.equal(afterDispose.favicon, null, 'favicon link must be removed on dispose');
assert.equal(afterDispose.title, 'DeepSeek Harness');
pass('dispose removes the favicon link and leaves the title untouched');

// ── no runtime errors anywhere ─────────────────────────────────────────────
assert.deepEqual(pageErrors, [], `unexpected page errors: ${pageErrors.join(' | ')}`);
assert.deepEqual(consoleErrors, [], `unexpected console errors: ${consoleErrors.join(' | ')}`);
pass('no page errors or console errors during the run');

await browser.close();
server.close();

console.log(`\nall ${results.length} browser E2E checks passed ✓`);
