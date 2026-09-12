// Unit + smoke tests for dsh-tab-status-dot.
//
// The bundle is a *classic script* executed in the browser: the module loader
// calls `window.__ModuleLoader__.load({ id, factory })`, then invokes
// `factory(require)` with NO CommonJS `module`/`exports` globals available.
// The tests therefore evaluate the file inside a `node:vm` sandbox that
// provides only browser-ish globals (`window`, `document`, `localStorage`) —
// reproducing the real environment and catching a missing CJS-shaped wrapper
// ("exports is not defined") that a require()/import harness would mask.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");

// ── sandbox: browser-like, deliberately WITHOUT module/exports/require ───────
const storage = new Map();
const localStorageStub = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v))
};

const sandbox = {
  window: {
    __ModuleLoader__: { load: (o) => { sandbox.loaded = o; } },
    localStorage: localStorageStub
  },
  document: undefined, // populated by the apply-level smoke test below
  console
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "client.js" });

assert.ok(sandbox.loaded, "module loader registration must run at script top level");
assert.equal(sandbox.loaded.id, "@pxy/dsh-tab-status-dot");

// Invoke the factory with ONLY a require function — exactly like the loader.
// (A sandbox-realm function can be called from the host; its body runs in its
// creation context where no `exports`/`module` bindings exist.)
const api = sandbox.loaded.factory((spec) => {
  throw new Error(`unexpected require: ${String(spec)}`);
});

assert.ok(api, "factory must return the plugin surface object");
assert.equal(typeof api.apply, "function");
assert.ok(Array.isArray(api.inject) && api.inject.includes("sessions"));
assert.ok(api.__test, "test seam must be exposed");

const { recompute, stateFor } = api.__test;

// ── helpers ───────────────────────────────────────────────────────────────────
const S = (id, running, pendingInteraction) => {
  const s = { id, running: running === true };
  if (pendingInteraction !== undefined) s.pendingInteraction = pendingInteraction;
  return s;
};
const snap = (byId, current) => ({ byId, current });
const fresh = (unreadIds = []) => ({ unread: new Set(unreadIds), prevRunning: new Map() });

// ── pure aggregation core ─────────────────────────────────────────────────────

// 1) running → idle while not open arms a completion reminder.
{
  const st = fresh();
  recompute(st, snap({ a: S("a", true) }, undefined));
  const r1 = recompute(st, snap({ a: S("a", false) }, undefined));
  assert.equal(JSON.stringify(r1), JSON.stringify({ green: true, blue: false }));
  assert.ok(st.unread.has("a"));
}

// 2) opening/selecting the session (clearIds) clears its reminder.
{
  const st = fresh(["a"]);
  const r = recompute(st, snap({ a: S("a", false) }, "a"), { clearIds: ["a"] });
  assert.equal(JSON.stringify(r), JSON.stringify({ green: false, blue: false }));
  assert.ok(!st.unread.has("a"));
}

// 3) several completions: green stays until EVERY one is viewed.
{
  const st = fresh();
  recompute(st, snap({ a: S("a", true), b: S("b", true) }, undefined));
  recompute(st, snap({ a: S("a", false), b: S("b", false) }, undefined));
  assert.equal(st.unread.size, 2);
  const g1 = recompute(st, snap({ a: S("a", false), b: S("b", false) }, "a"), { clearIds: ["a"] });
  assert.equal(g1.green, true); // b still unviewed
  recompute(st, snap({ a: S("a", false), b: S("b", false) }, "b"), { clearIds: ["b"] });
  assert.equal(st.unread.size, 0);
}

// 4) completion while the session IS open and the page IS visible does not arm
//    (the operator is watching it).
{
  const st = fresh();
  recompute(st, snap({ a: S("a", true) }, "a"));
  const r = recompute(st, snap({ a: S("a", false) }, "a"));
  assert.equal(JSON.stringify(r), JSON.stringify({ green: false, blue: false }));
}

// 4b) completion of the OPEN session while the tab is HIDDEN DOES arm (the
//     operator was away and is not watching), and it clears once "viewed"
//     (explicit clearIds, e.g. read-dwell grace expiring on return).
{
  const st = fresh();
  recompute(st, snap({ a: S("a", true) }, "a"), { pageHidden: true });
  const r = recompute(st, snap({ a: S("a", false) }, "a"), { pageHidden: true });
  assert.equal(JSON.stringify(r), JSON.stringify({ green: true, blue: false }));
  assert.ok(st.unread.has("a"));
  const r2 = recompute(st, snap({ a: S("a", false) }, "a"), { clearIds: ["a"] });
  assert.equal(JSON.stringify(r2), JSON.stringify({ green: false, blue: false }));
  assert.equal(st.unread.size, 0);
}

// 5) blue tracks live pending interaction only; clearing it clears blue.
{
  const st = fresh();
  const b1 = recompute(st, snap({ a: S("a", false, "question") }, undefined));
  assert.equal(JSON.stringify(b1), JSON.stringify({ green: false, blue: true }));
  const b2 = recompute(st, snap({ a: S("a", false) }, undefined));
  assert.equal(JSON.stringify(b2), JSON.stringify({ green: false, blue: false }));
}

// 5b) On DSH 0.1.5+ the pending flag comes from the runtime observable
//     (opts.hasPending) and the summary is then NOT scanned.
{
  const st = fresh();
  const yes = recompute(st, snap({ a: S("a", false) }, undefined), { hasPending: true });
  assert.equal(JSON.stringify(yes), JSON.stringify({ green: false, blue: true }));
  const no = recompute(st, snap({ a: S("a", false) }, undefined), { hasPending: false });
  assert.equal(JSON.stringify(no), JSON.stringify({ green: false, blue: false }));
  // hasPending: false must win even if an old-style summary field is present
  const staleSummary = S("a", false, "question");
  const noStale = recompute(st, snap({ a: staleSummary }, undefined), { hasPending: false });
  assert.equal(JSON.stringify(noStale), JSON.stringify({ green: false, blue: false }));
}

// 6) green + blue coexist as separate dots.
{
  const st = fresh();
  recompute(st, snap({ a: S("a", true), b: S("b", false, "approval") }, undefined));
  const r = recompute(st, snap({ a: S("a", false), b: S("b", false, "approval") }, undefined));
  assert.equal(JSON.stringify(r), JSON.stringify({ green: true, blue: true }));
  assert.equal(stateFor(true, true), "both");
}

// 7) a fresh run supersedes the stale completion reminder.
{
  const st = fresh(["a"]);
  recompute(st, snap({ a: S("a", false) }, undefined)); // idle while unread present: stays
  const r = recompute(st, snap({ a: S("a", true) }, undefined));
  assert.equal(JSON.stringify(r), JSON.stringify({ green: false, blue: false }));
  assert.ok(!st.unread.has("a"));
}

// 8) reload persistence: pre-loaded reminders survive; idle-at-load sessions
//    are never armed retroactively.
{
  const st = fresh(["legacy"]);
  const r = recompute(st, snap({ legacy: S("legacy", false), x: S("x", false) }, undefined));
  assert.equal(JSON.stringify(r), JSON.stringify({ green: true, blue: false })); // legacy stays
  assert.ok(!st.unread.has("x")); // x never armed
}

// 9) removed sessions are pruned from reminders and running bits.
{
  const st = fresh(["gone"]);
  st.prevRunning.set("gone", false);
  const r = recompute(st, snap({ a: S("a", false) }, undefined));
  assert.equal(JSON.stringify(r), JSON.stringify({ green: false, blue: false }));
  assert.equal(st.unread.size, 0);
  assert.ok(!st.prevRunning.has("gone"));
}

// 10) background/hidden-tab completion: the running→idle edge was never
//     observed (prevRunning empty), but the runtime's own `completed` flag is
//     set — the reminder must still arm, and opening the session clears it.
{
  const C = (id) => ({ id, running: false, completed: true });
  const st = fresh();
  const r1 = recompute(st, snap({ a: C("a") }, undefined));
  assert.equal(JSON.stringify(r1), JSON.stringify({ green: true, blue: false }));
  assert.ok(st.unread.has("a"));
  // Edge + completed both present in one snapshot must not double-count issues.
  const st2 = fresh();
  recompute(st2, snap({ a: S("a", true) }, undefined)); // observed running first
  const r2 = recompute(st2, snap({ a: C("a") }, undefined)); // now idle + completed
  assert.equal(JSON.stringify(r2), JSON.stringify({ green: true, blue: false }));
  // Opening clears even while the completed flag lingers one frame.
  const r3 = recompute(st2, snap({ a: C("a") }, "a"), { clearIds: ["a"] });
  assert.equal(JSON.stringify(r3), JSON.stringify({ green: false, blue: false }));
  assert.equal(st2.unread.size, 0);
}

// ── apply-level smoke: full wiring against stub ctx / document / storage ─────
{
  const listeners = [];
  let currentSnap = { byId: { a: S("a", true) }, current: undefined, phase: "ready" };
  const fakeSessions = {
    list: {
      getSnapshot: () => currentSnap,
      subscribe: (fn) => { listeners.push(fn); return () => {}; }
    }
  };
  let cleanup = null;
  const fakeCtx = {
    get: (name) => (name === "sessions" ? fakeSessions : undefined),
    effect: (fn) => { cleanup = fn(); return cleanup; },
    on: () => () => {}
  };

  const favicon = { rel: "", href: "", parentNode: null };
  const head = {
    firstChild: null,
    lastChild: null,
    insertBefore: (el) => { el.parentNode = head; head.firstChild = el; head.lastChild = el; },
    appendChild: (el) => { el.parentNode = head; head.lastChild = el; },
    removeChild: (el) => { if (el.parentNode === head) el.parentNode = null; }
  };
  const fakeDoc = {
    title: "DeepSeek Harness", // the plugin never touches the page title now
    head,
    createElement: (tag) => (tag === "link" ? favicon : {}),
    querySelector: () => null,
    querySelectorAll: () => [] // no pre-existing icon links to take over
  };
  sandbox.document = fakeDoc;

  // effect body runs synchronously: initial snapshot applied immediately.
  api.apply(fakeCtx);
  assert.equal(fakeDoc.title, "DeepSeek Harness"); // title untouched
  assert.ok(favicon.href.includes("charset=utf-8"));
  assert.ok(favicon.href.includes("64748b")); // light theme → slate neutral dot

  // A session finishes while not open → light-green favicon.
  currentSnap = { byId: { a: S("a", false) }, current: undefined, phase: "ready" };
  for (const fn of listeners) fn();
  assert.equal(fakeDoc.title, "DeepSeek Harness"); // title untouched
  assert.ok(favicon.href.includes("4ade80")); // light-green fill
  assert.equal(storage.get("dsh.tab-status-dot.unread.v1"), '["a"]');

  // Opening that session clears the reminder → back to neutral favicon.
  currentSnap = { byId: { a: S("a", false) }, current: "a", phase: "ready" };
  for (const fn of listeners) fn();
  assert.equal(fakeDoc.title, "DeepSeek Harness"); // title untouched
  assert.ok(favicon.href.includes("64748b")); // neutral slate again
  assert.equal(storage.get("dsh.tab-status-dot.unread.v1"), "[]");

  // Pending interaction on an unopened session → light-blue favicon.
  currentSnap = { byId: { b: S("b", false, "question") }, current: "a", phase: "ready" };
  for (const fn of listeners) fn();
  assert.equal(fakeDoc.title, "DeepSeek Harness"); // title untouched
  assert.ok(favicon.href.includes("60a5fa")); // light-blue fill

  // Answering it (pending gone) clears blue.
  currentSnap = { byId: { b: S("b", false) }, current: "a", phase: "ready" };
  for (const fn of listeners) fn();
  assert.equal(fakeDoc.title, "DeepSeek Harness"); // title untouched
  assert.ok(favicon.href.includes("64748b")); // neutral again

  // Both conditions → two separate light dots in the favicon: first c must
  // actually finish a run (running → idle while unopened) and b must hold an
  // unanswered question.
  currentSnap = { byId: { c: S("c", true) }, current: "a", phase: "ready" };
  for (const fn of listeners) fn();
  currentSnap = {
    byId: { c: S("c", false), b: S("b", false, "question") },
    current: "a",
    phase: "ready"
  };
  for (const fn of listeners) fn();
  assert.equal(fakeDoc.title, "DeepSeek Harness"); // title untouched
  assert.ok(favicon.href.includes("4ade80")); // green dot present
  assert.ok(favicon.href.includes("60a5fa")); // blue dot present

  // Disposal removes our favicon link and leaves the title alone.
  assert.equal(typeof cleanup, "function");
  cleanup();
  assert.equal(fakeDoc.title, "DeepSeek Harness");
  assert.equal(favicon.parentNode, null);

  sandbox.document = undefined;
}

console.log("all tab-status-dot tests passed ✓ (pure core + browser-sandbox smoke)");



