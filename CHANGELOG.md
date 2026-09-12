# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **BusyBox `sh` (Alpine Linux) coverage** for the shell installer: a CI job runs
  `.github/ci/alpine-installer-check.sh` inside an `alpine:3.20` container and checks install, idempotent
  re-run, append-to-existing-entries, uninstall-keeps-others and uninstall-restores-template, validating the
  resulting YAML with `js-yaml` at every step.

The installers are now exercised in CI on **four** real environments:
`ubuntu-latest` (`sh` = dash), `macos-latest` (BSD userland), Alpine/BusyBox `sh`, and
`windows-latest` (Windows PowerShell 5.1).

## [0.1.2] — 2026-02

### Fixed

- **Both installers could write an invalid `cordis.patch.yml`.** The profile template dsh ships is a
  three-line comment header followed by a bare `[]` (and no trailing newline). The empty-list detection
  only matched a file whose *entire* content was `[]`, so a normal fresh profile took the “append” path and
  ended up with two YAML root nodes (`[]` plus the new sequence) — which the loader rejects and which would
  break the profile. Both installers now look at the file's real entries (ignoring comments):
  - no real entries → the file is rewritten with the original comment header preserved and the registration block;
  - existing entries → the block is appended as before.
- **Uninstall could leave a comments-only file** (no `[]`, i.e. not a valid patch list). It now restores the
  comment header plus a real `[]` token.
- Idempotency check is tighter (`id: tab-status-dot` instead of any occurrence of the string).
- `install.sh`: dropped `cd --` (dash compatibility) on top of the earlier portability fixes.

### Added

- CI job **`installers-linux`** that runs `install.sh` on a real Linux runner (`ubuntu-latest`, where `sh` is
  dash) against the exact shipped profile template, validates the resulting YAML with `js-yaml`, and checks the
  idempotent, append and uninstall paths.

## [0.1.1] — 2026-02

### Added

- **Beginner-friendly installation guides** for Windows, **Linux** and macOS:
  [`GETTING-STARTED.zh-CN.md`](GETTING-STARTED.zh-CN.md) and [`GETTING-STARTED.md`](GETTING-STARTED.md),
  linked from both READMEs.

### Fixed

- `install.sh` is now more portable: no dependency on `dirname`/`sed`/`tail`/`wc`, and Windows-style
  (`C:\...\install.sh`) invocations resolve the script directory correctly.
- `install.ps1` no longer prints mojibake under Windows PowerShell 5.1 (ASCII-only console output), and its
  `-Source` default resolves reliably when launched with `powershell -File`.
- Both installers replace the shipped empty `[]` patch template instead of appending after it (appending
  produced two YAML root nodes, which the loader rejects), and the uninstallers restore `[]`.

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
