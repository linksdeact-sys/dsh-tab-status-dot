# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-02

### Added

- Browser-tab **favicon status dot** for the DeepSeek Harness web GUI, driven by the shared client-runtime `sessions` service:
  - neutral dot by default (and while tasks run), following the system light/dark theme
  - **light-green** dot when a session finished while the operator was not looking
  - **light-blue** dot while a session waits for the operator's choice (question / approval / plan review)
  - two separate dots when both conditions coexist
- Reminder semantics designed around real usage:
  - a completion only clears once the session has been **opened/viewed**; an already-open session counts as read after ~1 s back on the page
  - a blue dot clears only after the choice is **answered** (viewing alone does not clear it)
  - unviewed completions persist in `localStorage` and survive page reloads
- Hidden-tab resilience: 1 Hz snapshot poll, a timeout-based paint fallback (rAF is suspended in background tabs), and immediate refresh on `visibilitychange` / window focus.
- Favicon takeover: competing `<link rel=icon>` elements are stashed so the dot always wins, and restored on unload.
- Rendering pipeline with frame coalescing and change checks (no DOM writes when nothing changed; raw-string favicon comparison).
- One-command installers: `install.ps1` (Windows) and `install.sh` (macOS/Linux) — copy into the profile, register the `cordis.patch.yml` row idempotently, and support `--uninstall`.
- Tests: `node test/core.test.mjs` — pure state-machine cases plus a browser-sandbox (`node:vm`) smoke test that reproduces the DSH module-loader environment.
- GitHub Actions workflow running the tests on every push / pull request.

### Notes

- Browser tab titles are plain text, so a coloured dot there can only be a fixed-size emoji; state colour therefore lives in the favicon and the page title is left untouched.
