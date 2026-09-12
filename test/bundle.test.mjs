// Validate the package against the DeepSeek Harness plugin conventions, so a
// packaging regression fails here instead of silently disabling the plugin in
// someone's profile (that is exactly how the indicator once went dark).
//
// Checks, in the order the loader cares about them:
//   1. `exports["./client"]` resolves to a real file (the browser bundle the
//      module host serves at /plugins/<pkg>/client.js);
//   2. `dsh.client.platform === "web"` — the declaration that puts the package
//      on the browser roster at all;
//   3. no package-name `dsh.client.inject` edges: package names move between
//      DSH releases and an edge naming a package that no longer exists keeps
//      the row from ever materializing (the plugin waits on service names via
//      the bundle's exported `inject` instead);
//   4. `dsh.bundle.patch` points at a bundle patch layer that registers our row
//      (the official "list the package in dsh.profile.bundles" route);
//   5. the host half exists and exports `apply`.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const local = (rel) => resolve(ROOT, rel);

// 1. the browser bundle the module host serves
const clientExport = pkg.exports?.['./client'];
const clientRel = typeof clientExport === 'string' ? clientExport : clientExport?.default;
assert.ok(typeof clientRel === 'string', 'package.json must export "./client" (the browser bundle)');
assert.ok(existsSync(local(clientRel)), `exports["./client"] must point at a real file, got ${clientRel}`);

// 2. the client declaration
assert.equal(pkg.dsh?.client?.platform, 'web', 'dsh.client.platform must be "web"');
assert.equal(pkg.type, 'module');

// 3. no version-coupled package-name inject edges
const inject = pkg.dsh?.client?.inject;
assert.ok(inject === undefined || (Array.isArray(inject) && inject.length === 0),
  'dsh.client.inject must stay empty: a package-name edge that a future DSH no longer ships keeps the row from materializing');

// 4. official bundle activation route
const bundleRel = pkg.dsh?.bundle?.patch;
assert.ok(typeof bundleRel === 'string', 'dsh.bundle.patch must be declared so the package works as a bundle');
const bundlePath = local(bundleRel);
assert.ok(existsSync(bundlePath), `dsh.bundle.patch must point at a real file, got ${bundleRel}`);
const patch = readFileSync(bundlePath, 'utf8');
assert.ok(/^- insert:/m.test(patch), 'the bundle patch must contain an insert list');
assert.ok(new RegExp(`^\\s+- id: tab-status-dot$`, 'm').test(patch), 'the bundle patch must insert the tab-status-dot row');
assert.ok(patch.includes(`name: '${pkg.name}'`), `the bundle patch must name the package (${pkg.name})`);
// The bug that broke installs: appending rows after a bare `[]` root yields two
// YAML documents. A shipped bundle patch must never contain a bare root list.
assert.ok(!/^\s*\[\]\s*$/m.test(patch), 'the bundle patch must not contain a bare `[]` root');

// 5. host half
assert.ok(existsSync(local(pkg.main)), 'the package main (host half) must exist');
const host = readFileSync(local(pkg.main), 'utf8');
assert.ok(/export\s+(function\s+apply|{[^}]*\bapply\b)/.test(host), 'the host half must export apply');

console.log(`bundle/package conventions OK ✓ (${pkg.name}@${pkg.version}, bundle patch ${bundleRel})`);
