# dsh-tab-status-dot

A tiny browser-side plugin for the **DeepSeek Harness Web GUI** (`dsh web`) that shows a **status dot as the browser-tab favicon**, telling you at a glance whether any conversation has finished while you were away, or is waiting for you to make a choice.

No page-title text is modified — the indicator lives entirely in the tab icon (favicon), where size and colour are fully controllable.

![states](docs/states.svg)

## States

| Favicon | Meaning | Returns to neutral when |
|---|---|---|
| Neutral dot | Default / a task is currently running | — |
| Light-green dot | ≥1 session finished running while you were **not looking** (tab in background, or viewing another session) | You **open** that session; if it was already the open session, staying on the page ≈1 s counts as read. Every unfinished "viewed" item must be handled before the dot returns to neutral |
| Light-blue dot | A session is **waiting for your choice** (question / approval / plan review) — not answered yet | Only after you **actually answer/choose** and the run resumes; merely viewing does not clear it |
| Two light dots (green + blue) | Both conditions above exist at the same time | Green clears by viewing; blue clears by answering |

### Rules

- A session finishing while you are **looking at the page and at that session** does **not** light up (you saw the result).
- A session finishing while the tab is **hidden/backgrounded lights up green even if it is the currently open session** — you were not actually watching it.
- Running again, or deleting the session, removes its stale reminder.
- Unviewed completions persist in `localStorage`, so a page reload does not lose them.

## Why it exists

The runtime's built-in model treats "session selected" as "viewed" — so a task finishing in the *open* session while the tab was hidden never produced a reminder. This plugin redefines "you were not looking" as *session not selected **or** page hidden*, which matches how people actually use the app (start a task → switch away → come back).

## How it works

- Registered as a **dual-face cordis plugin** (`dsh.client`, `platform: web`): the host half (`lib/index.js`) is an empty `apply`, the browser half (`exports["./client"]` → `lib/client.js`) is a classic-script module-loader bundle.
- Subscribes to the shared client-runtime `sessions` service (`ctx.get("sessions").list`), an observable snapshot carrying per-session `running`, `pendingInteraction`, `completed` and the open-session `current` id.
- Completeness signals: the runtime's own `completed` flag **plus** our own `running→idle` edge detection **plus** a "page was hidden since last visible observation" flag — so reminders are armed even when the browser throttles background timers and the transition is only observed after you return.
- Background resilience: browsers suspend `requestAnimationFrame` (and some event delivery) for hidden tabs, so the plugin also
  - polls the cheap cached snapshot every second,
  - paints through a short-timeout fallback as well as rAF,
  - refreshes immediately on `visibilitychange` / window focus.
- Rendering is coalesced & change-checked: at most one DOM write per frame, raw-string favicon comparison (never the normalized `.href` read-back), no writes when nothing changed.
- Takes over the favicon (`<link rel=icon>`) so browsers do not pick a competing brand icon; the original icon is restored on unload.

## Requirements

- DeepSeek Harness with a `web` profile (see the runtime's profile/plugin conventions), any modern browser.

## Install (DeepSeek Harness web profile)

The profile lives at `%DSH_HOME%/profiles/web` (e.g. `C:\Users\<you>\.dsh\profiles\web`).

1. Copy this package into the profile's module tree:

   ```
   <profile>/node_modules/@pxy/dsh-tab-status-dot/
   ├── package.json
   └── lib/
       ├── index.js
       └── client.js
   ```

   (No pnpm/npm install needed: the loader resolves packages from the profile directory's own `node_modules`.)

2. Append an entry to `<profile>/cordis.patch.yml` (the user patch layer):

   ```yaml
   - insert:
       - id: tab-status-dot
         name: '@pxy/dsh-tab-status-dot'
   ```

3. The running instance hot-reloads user patches (~1 s) and serves the new client bundle; **refresh the browser page** (hard refresh if the old bundle was cached). If your instance does not hot-reload patches, restart `dsh web` once.

See [`INSTALL.md`](INSTALL.md) for details and troubleshooting.

## Development

```
├── package.json          # dsh.client declaration (platform=web, injects client-runtime)
├── lib/
│   ├── index.js          # host half: empty apply (pure client plugin convention)
│   └── client.js         # browser bundle: module-loader factory + state machine + renderer
└── test/
    └── core.test.mjs     # pure-logic + browser-sandbox smoke tests (node:vm, no CJS globals)
```

Run the tests:

```sh
node test/core.test.mjs
```

The test harness evaluates `client.js` inside a `node:vm` sandbox that provides only browser-ish globals (`window`, `document`, `localStorage`) — the same conditions the DSH module loader creates — so a missing CommonJS-style wrapper (`exports is not defined`) or any load-time crash is caught before it ever reaches a real page.

Edit `lib/client.js` → refresh the page to test (the bundle is served `no-cache`).

## Notes & limitations

- Browser tab **titles are plain text**: a coloured dot there can only be an emoji, whose size/colour are fixed. That is why state colours live in the favicon and the page title is left untouched.
- Reminders are per-browser (`localStorage`); two browser tabs of the same profile share storage with last-write-wins semantics.

## License

[MIT](LICENSE)
