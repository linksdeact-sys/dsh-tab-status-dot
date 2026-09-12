// @pxy/dsh-tab-status-dot — client bundle (classic script, module-loader factory)
//
// Browser-side plugin: shows a status dot in front of the page-tab title and a
// matching favicon, aggregated over every session in the workspace:
//   • white  — nothing pending (default, also while sessions are running)
//   • green  — at least one session finished running while it was NOT the open
//              session, and the operator has not opened it since (clears per
//              session the moment that session becomes the open/selected one)
//   • blue   — at least one session currently waits on an operator choice
//              (question / approval / plan-review); clears when the operator
//              answers it and the run resumes (viewing alone does not clear)
//   • green + blue shown as TWO separate dots when both conditions hold.
//
// Data source: the shared client-runtime `sessions` service — its `.list`
// observable snapshot already carries per-session `running`,
// `pendingInteraction` and the `current` (open) selection, so this plugin
// only aggregates, never re-derives transport state.
//
// Completion reminders are persisted in localStorage so they survive a page
// reload until every finished-but-unopened session has been viewed.

window.__ModuleLoader__.load({
	id: "@pxy/dsh-tab-status-dot",
	factory: (require) => {
		// The DSH module loader invokes this factory with ONLY `require` — no
		// Node CommonJS `module`/`exports` globals exist in the browser. Mirror
		// the official bundles exactly: build the CJS-shaped surface ourselves.
		const module = { exports: {} };
		const exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const STORAGE_KEY = "dsh.tab-status-dot.unread.v1";
		// How long the already-open session must stay on screen after returning
		// before its "finished while you were away" reminder counts as read.
		const DWELL_MS = 1000;

		// ── pure aggregation core (kept DOM-free for unit tests) ──────────────
		// `state.unread` is a Set of session ids with a pending completion
		// reminder; `state.prevRunning` maps session id → last observed running
		// bit. Both are mutated in place; returns { green, blue }.
		//
		// opts:
		//   pageHidden — the page tab was hidden at observation time. A session
		//       finishing while hidden counts as unviewed even if it was the
		//       open one (the operator was NOT actually looking at it).
		//   clearIds  — session ids the operator just opened/viewed; their
		//       reminders are cleared (clicking a row, or the read-dwell grace
		//       expiring for the already-open session).
		//   hasPending — whether any session currently waits for an operator
		//       choice, taken from the runtime's pending-interaction source when
		//       available. `undefined` means "unknown" and the summaries are
		//       scanned instead (older DSH versions carried the flag there).
		function recompute(state, snapshot, opts = {}) {
			const byId = snapshot.byId ?? {};
			const current = snapshot.current;
			const unread = state.unread;
			const prevRunning = state.prevRunning;
			const pageHidden = opts.pageHidden === true;
			const clearIds = opts.clearIds ?? [];
			const scanPending = opts.hasPending === undefined;

			// Sessions that vanished (deleted/pruned) can never be viewed — drop them.
			for (const id of [...prevRunning.keys()]) {
				if (!(id in byId)) prevRunning.delete(id);
			}
			for (const id of [...unread]) {
				if (!(id in byId)) unread.delete(id);
			}

			let blue = opts.hasPending === true;
			for (const id of Object.keys(byId)) {
				const s = byId[id];
				const running = s.running === true;
				const prevRun = prevRunning.get(id);
				const isOpen = current === id;
				const completed = s.completed === true;

				// 1) Explicitly viewed just now (clicked its row / dwell grace).
				for (const clear of clearIds) {
					if (clear === id) unread.delete(id);
				}
				// 2) The runtime's own "finished while not selected" flag arms a
				//    reminder even when we never observed the running→idle edge
				//    (e.g. tab hidden for the whole run). A hidden-tab finish of
				//    the OPEN session has no such flag, so the edge rule (4)
				//    covers it via pageHidden instead.
				if (completed && (!isOpen || pageHidden)) unread.add(id);
				// 3) A fresh run supersedes any stale reminder; record the bit.
				if (running) {
					if (prevRun === false) unread.delete(id);
					prevRunning.set(id, true);
				} else {
					// 4) running → idle arms a reminder unless the operator was
					//    actually looking (session open AND page visible).
					if (prevRun === true && (!isOpen || pageHidden)) unread.add(id);
					prevRunning.set(id, false);
				}
				// 5) Fallback only: older DSH versions put the per-session pending
				//    flag on the summary itself. Newer ones expose the pending set
				//    through the runtime's own observable (opts.hasPending), and
				//    then this scan is skipped entirely.
				if (scanPending && s.pendingInteraction !== undefined && s.pendingInteraction !== null) {
					blue = true;
				}
			}
			return { green: unread.size > 0, blue };
		}

		function loadUnread() {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY);
				if (raw) {
					const arr = JSON.parse(raw);
					if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === "string"));
				}
			} catch {}
			return new Set();
		}

		// ── rendering ──────────────────────────────────────────────────────────
		const STATE_WHITE = "white";
		const STATE_GREEN = "green";
		const STATE_BLUE = "blue";
		const STATE_BOTH = "both";

		function stateFor(green, blue) {
			if (green && blue) return STATE_BOTH;
			if (green) return STATE_GREEN;
			if (blue) return STATE_BLUE;
			return STATE_WHITE;
		}

		const FAVICON_SVG = {
			// Colored dots: shrank ~1/3 (r 5.6 → 3.7), lightened, plus a thin
			// darker ring so the pale fill stays legible at favicon size.
			green:
				"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='3.7' fill='#4ade80' stroke='#22c55e' stroke-width='1'/></svg>",
			blue: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='3.7' fill='#60a5fa' stroke='#3b82f6' stroke-width='1'/></svg>",
			both:
				"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='4.6' cy='8' r='2.6' fill='#4ade80' stroke='#22c55e' stroke-width='0.9'/><circle cx='11.4' cy='8' r='2.6' fill='#60a5fa' stroke='#3b82f6' stroke-width='0.9'/></svg>"
		};

		// Neutral favicon dot: ~1/3 smaller than before (r 5.2 → 3.5) and themed
		// (near-white on dark systems, slate on light systems — visible on both).
		function whiteSvg(isDark) {
			const fill = isDark ? "#e8ecf2" : "#64748b";
			const stroke = isDark ? " stroke='#9aa3b2' stroke-width='1.2'" : "";
			return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='3.5' fill='${fill}'${stroke}/></svg>`;
		}

		function faviconSvg(state, isDark) {
			return state === STATE_WHITE ? whiteSvg(isDark) : FAVICON_SVG[state];
		}

		function faviconHref(state, isDark) {
			return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(faviconSvg(state, isDark));
		}

		function apply(ctx) {
			if (typeof window === "undefined" || typeof document === "undefined") return;
			const doc = document;
			const state = { unread: loadUnread(), prevRunning: new Map() };
			let iconLink = null;
			let lastFlags = null;
			// Follow the system light/dark scheme for the neutral dot colour.
			let isDark = false;
			try {
				if (typeof window.matchMedia === "function") isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			} catch {}

			ctx.effect(() => {
				// Coalesced, change-checked renderer state (one paint per frame
				// at most, no DOM writes when nothing changed).
				let lastSnapRef = null;
				let paintedState = null; // state currently shown
				let pendingState = null; // desired state, not yet painted
				let rafId = 0;
				let timerId = 0;
				let lastFaviconRaw = "";
				let disposed = false;

				function currentStateName() {
					return lastFlags ? stateFor(lastFlags[0], lastFlags[1]) : STATE_WHITE;
				}
				function paint(stateName) {
					// Keep our icon link the LAST rel=icon in <head> so browsers
					// that honour the last declaration show OUR dot, not a brand
					// icon the app may (re)insert.
					try {
						if (iconLink && doc.head && iconLink.parentNode === doc.head) doc.head.appendChild(iconLink);
					} catch {}
					// Compare against the exact string we assigned, never the
					// normalized .href read-back (data-URI normalization would
					// otherwise fail equality and rewrite the icon every frame).
					const href = faviconHref(stateName, isDark);
					if (href !== lastFaviconRaw) {
						lastFaviconRaw = href;
						iconLink.href = href;
					}
				}
				function clearFlushHandles() {
					if (rafId !== 0 && typeof cancelAnimationFrame === "function") cancelAnimationFrame(rafId);
					if (timerId !== 0 && typeof clearTimeout === "function") clearTimeout(timerId);
					rafId = 0;
					timerId = 0;
				}
				function doFlush() {
					rafId = 0;
					timerId = 0;
					if (disposed) return;
					const s = pendingState;
					pendingState = null;
					if (s === null || s === void 0) return;
					paintedState = s;
					paint(s);
				}
				function armFlush() {
					if (disposed) return;
					// rAF for snappy updates when the tab is visible…
					if (rafId === 0 && typeof requestAnimationFrame === "function") rafId = requestAnimationFrame(doFlush);
					// …plus a short-timeout fallback: rAF is suspended while the
					// tab is hidden/backgrounded, so this keeps the favicon/title
					// status updating even then (background timers still fire).
					if (timerId === 0 && typeof setTimeout === "function") timerId = setTimeout(doFlush, 200);
				}
				function schedule(stateName) {
					if (stateName === paintedState) return; // already showing it
					pendingState = stateName;
					if (typeof requestAnimationFrame === "function") {
						armFlush();
					} else {
						// Test/fallback env without rAF: paint synchronously.
						pendingState = null;
						paintedState = stateName;
						paint(stateName);
					}
				}
				// Force an immediate paint of the given state (theme changes,
				// external title writes, regaining visibility).
				function repaintNow(stateName) {
					clearFlushHandles();
					paintedState = stateName;
					pendingState = null;
					paint(stateName);
				}
				// Re-read the freshest snapshot and re-assert the paint.
				function refreshNow() {
					if (disposed) return;
					try {
						applySnapshot();
						repaintNow(currentStateName());
					} catch (err) {
						console.error("[tab-status-dot] refresh failed:", err);
					}
				}

				// Take over the favicon: stash any pre-existing icon links, then
				// make our dot the only rel=icon (browser choice among several
				// icons is not guaranteed to pick ours otherwise). They are put
				// back on dispose.
				const removedIcons = [];
				try {
					const links = doc.querySelectorAll ? Array.from(doc.querySelectorAll('link[rel~="icon"], link[rel~="shortcut icon"]')) : [];
					for (const el of links) {
						if (el.id === "dsh-tab-status-dot-favicon") continue;
						if (el.parentNode) el.parentNode.removeChild(el);
						removedIcons.push(el);
					}
				} catch {}
				iconLink = doc.createElement("link");
				iconLink.rel = "icon";
				iconLink.id = "dsh-tab-status-dot-favicon";
				iconLink.href = faviconHref(STATE_WHITE, isDark);
				lastFaviconRaw = iconLink.href;
				doc.head.appendChild(iconLink);

				let lastSerialized = null;
				function persist() {
					const serialized = JSON.stringify([...state.unread]);
					if (serialized === lastSerialized) return;
					lastSerialized = serialized;
					try {
						window.localStorage.setItem(STORAGE_KEY, serialized);
					} catch {}
				}

				let prevCurrentId = null;
				let dwellStartAt = 0;
				let pageWasHidden = false; // page hidden at any point since the last visible observation

				// ── pending-interaction source ────────────────────────────────────
				// DSH ≤0.1.0-rc.x exposed "this session waits for a choice" as a
				// summary field; DSH 0.1.5-rc.1 moved it to the session UI service
				// (`uiSession.pendingInteractions`, an observable snapshot of
				// SessionId → interaction). We attach lazily so the plugin keeps
				// working on BOTH layouts and never hard-fails when the service is
				// absent: `hasPending === undefined` means "unknown" and the
				// summaries are scanned instead.
				let pendingUnsub = null;
				let pendingKnown = false;
				let pendingCount = 0;

				function attachPendingSource() {
					if (disposed || pendingUnsub !== null) return;
					try {
						const uiSession = ctx.get("uiSession");
						const pending = uiSession && uiSession.pendingInteractions;
						if (!pending || typeof pending.subscribe !== "function") return;
						const read = () => {
							const snapshot = pending.getSnapshot();
							pendingKnown = true;
							pendingCount = snapshot && typeof snapshot.size === "number" ? snapshot.size : 0;
						};
						read();
						pendingUnsub = pending.subscribe(() => {
							read();
							applySnapshot(true); // pending changes do not touch the list snapshot
						});
					} catch (err) {
						console.error("[tab-status-dot] pending source unavailable:", err);
					}
				}

				function applySnapshot(force) {
					if (disposed) return;
					try {
						const snap = sessions.list.getSnapshot();
						// phase 'pending' = no list baseline yet; keep last render.
						if (!snap || snap.phase === "pending") return;
						// Same snapshot reference re-published → no data change
						// (unless the caller forces a repaint, e.g. pending changed).
						if (!force && snap === lastSnapRef) return;
						lastSnapRef = snap;

						const pageHidden = doc.hidden === true;
						if (pageHidden) pageWasHidden = true;
						// A completion edge observed now still counts as "finished
						// while the operator was away" when the page was hidden at
						// some point since our last visible observation (e.g. the
						// browser throttled background timers so we only learn
						// about the transition after returning).
						const effectiveHidden = pageHidden || pageWasHidden;

						const current = snap.current;
						const clearIds = [];

						// A) Selecting a session (clicking its row) while the page
						//    is visible counts as viewing it. (The read-dwell grace
						//    for the ALREADY-open session lives in tick(), because
						//    it must advance even when the snapshot reference never
						//    changes after the operator returns.)
						if (current !== void 0 && current !== prevCurrentId && !effectiveHidden) clearIds.push(current);

						prevCurrentId = current;
						const { green, blue } = recompute(state, snap, {
							pageHidden: effectiveHidden,
							clearIds,
							hasPending: pendingKnown ? pendingCount > 0 : undefined
						});
						persist();
						if (!pageHidden) pageWasHidden = false;
						lastFlags = [green, blue];
						schedule(stateFor(green, blue));
					} catch (err) {
						console.error("[tab-status-dot] update failed:", err);
					}
				}

				// 1 Hz heart-beat. It advances the read-dwell grace for the
				// ALREADY-open session (armed by a hidden-tab finish) and then
				// re-checks the list for data changes. Dwell must NOT sit behind
				// the snapshot-identity dedupe in applySnapshot, or it would
				// never advance once the operator returns and nothing else emits.
				function tick() {
					if (disposed) return;
					attachPendingSource(); // attach once the session UI service exists (newer DSH)
					try {
						const snap = sessions.list.getSnapshot();
						if (snap && snap.phase !== "pending") {
							const pageHidden = doc.hidden === true;
							const current = snap.current;
							if (pageHidden) {
								dwellStartAt = 0;
							} else if (current !== void 0 && state.unread.has(current)) {
								const now = Date.now();
								if (dwellStartAt === 0) {
									dwellStartAt = now;
								} else if (now - dwellStartAt >= DWELL_MS) {
									dwellStartAt = 0;
									state.unread.delete(current);
									const { green, blue } = recompute(state, snap, {
										pageHidden: false,
										hasPending: pendingKnown ? pendingCount > 0 : undefined
									});
									persist();
									lastFlags = [green, blue];
									schedule(stateFor(green, blue));
								}
							} else {
								dwellStartAt = 0;
							}
						}
					} catch (err) {
						console.error("[tab-status-dot] tick failed:", err);
					}
					applySnapshot();
				}

				const sessions = ctx.get("sessions");
				const unsub = sessions.list.subscribe(applySnapshot);
				attachPendingSource();
				applySnapshot();

				// Background resilience: browsers throttle/suspend rAF and even
				// event delivery for hidden tabs, so a task that finishes (or a
				// question that waits) while the user is on another page would
				// never repaint the favicon. Counter-measures:
				//   1) poll the cheap cached snapshot every second, and
				//   2) refresh immediately when the page becomes visible/focused.
				const pollId = typeof setInterval === "function" ? setInterval(tick, 1000) : 0;
				let visibilityCleanup = () => {};
				try {
					const onVisibilityChange = () => {
						if (doc.hidden === true) pageWasHidden = true;
						else refreshNow();
					};
					const onFocus = () => refreshNow();
					if (typeof document.addEventListener === "function") document.addEventListener("visibilitychange", onVisibilityChange);
					if (typeof window.addEventListener === "function") window.addEventListener("focus", onFocus);
					visibilityCleanup = () => {
						try {
							if (typeof document.removeEventListener === "function") document.removeEventListener("visibilitychange", onVisibilityChange);
							if (typeof window.removeEventListener === "function") window.removeEventListener("focus", onFocus);
						} catch {}
					};
				} catch {}

				// Repaint the neutral dot when the system theme changes live.
				let themeMedia = null;
				let themeDispose = () => {};
				try {
					if (typeof window.matchMedia === "function") {
						themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
						if (typeof themeMedia.addEventListener === "function") {
							const onChange = () => {
								isDark = themeMedia.matches;
								if (!disposed) repaintNow(currentStateName());
							};
							themeMedia.addEventListener("change", onChange);
							themeDispose = () => themeMedia.removeEventListener("change", onChange);
						}
					}
				} catch {}

				// The status dot lives ONLY in the favicon — the page <title> is
				// never touched, so no title observer is needed.

				return () => {
					disposed = true;
					if (pollId !== 0 && typeof clearInterval === "function") clearInterval(pollId);
					clearFlushHandles();
					themeDispose();
					visibilityCleanup();
					unsub();
					try {
						if (typeof pendingUnsub === "function") pendingUnsub();
					} catch {}
					pendingUnsub = null;
					// Put the original icons back, then remove our icon link.
					try {
						if (iconLink && iconLink.parentNode) iconLink.parentNode.removeChild(iconLink);
					} catch {}
					try {
						for (const el of removedIcons) {
							if (el.parentNode) el.parentNode.removeChild(el);
							doc.head.appendChild(el);
						}
					} catch {}
				};
			}, "tab-status-dot: indicator");

			// A new connection generation replays the baseline; forget observed
			// running bits so replay never mints phantom completion edges. Unread
			// reminders persist across reconnects and reloads on purpose.
			ctx.on("connection/reset", () => {
				state.prevRunning.clear();
			});
		}

		// Required services (service names, awaited before apply runs). This is
		// deliberately the ONLY dependency we declare: package-name edges in
		// `dsh.client.inject` are version-coupled (the sessions runtime moved
		// from @deepseek-ai/dsh-client-runtime to
		// @deepseek-ai/dsh-api-session-controller in DSH 0.1.5-rc.1, and an edge
		// naming a package that no longer exists keeps the row from ever
		// materializing). Waiting on the service name instead works on both.
		// The session UI service carrying pending interactions is discovered
		// lazily, so older layouts keep working through the summary fallback.
		const inject = ["sessions"];

		exports.apply = apply;
		exports.inject = inject;
		// Test seam: pure core, no DOM/window dependencies.
		exports.__test = { recompute, stateFor, loadUnread, STORAGE_KEY };
		return module.exports;
	}
});
