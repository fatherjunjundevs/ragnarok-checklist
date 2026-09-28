# Ragnarok Tracker v5.0 — QA / Proof Check

## Static validation
- `assets/app.js`: passed `node --check`.
- `api/health.js`: passed `node --check`.
- `api/sync.js`: passed `node --check`.
- `sw.js`: passed `node --check`.
- `manifest.webmanifest`, `vercel.json`, and `package.json`: parsed successfully as JSON.
- HTML ID scan: no duplicate IDs; direct JavaScript ID references matched the document.
- Prontera assets extracted successfully: separate WebP artwork and MP3 music.

## Browser smoke tests
The app was injected into Chromium 144 through the Chrome DevTools Protocol for runtime UI testing.

Passed:
- App reaches `data-ready=true`.
- Default render creates 13 daily + 2 weekly quest rows.
- Daily counter starts at `0 / 13`; weekly counter starts at `0 / 2`.
- `Monster Extermination` renders correctly.
- Quest checkbox updates both section and sticky quick-bar progress.
- Hide Completed reduces the visible task list.
- Finish Before Reset mode toggles and applies its body state.
- History dialog opens and renders 35 daily history cells.
- Settings dialog opens.
- Adding a quest works.
- Quest note, favorite, category, and Urgent priority save and render.
- Adding a second character updates both character tabs and the sticky quick switcher.
- Daily section Collapse / Expand works.
- Compact mode applies.
- Desktop pointer drag passed: `Quest Board` moved from General to Guild.
- Mobile touch drag emulation passed: `Quest Board` also moved from General to Guild using touch events.

## Responsive visual QA
- Desktop viewport inspected at 1440 × 1100.
- Mobile viewport inspected at 390 × 844 plus a full-page capture.
- Desktop shows a two-column Daily / Weekly dashboard.
- Mobile collapses to a clean single-column layout with sticky quick controls.

## Reset-boundary tests
UTC+7 / 5:00 AM logic was checked at exact boundaries:
- 2026-09-28 04:59:59 UTC+7 → still previous server day/week.
- 2026-09-28 05:00:00 UTC+7 → new server day and Monday weekly period.
- Tuesday 05:00 UTC+7 changes the daily period but preserves the Monday weekly key.

## Cloud API mock tests
The Vercel `/api/sync` handler was executed against an in-memory mocked Supabase REST endpoint.

Passed:
- Create new room → revision 1.
- Pull correct room/secret → returns revision and state.
- Stale base revision → HTTP 409 conflict with server state.
- Correct revision update → revision increments to 2.
- Wrong pairing secret → HTTP 403.
- JSON body supplied as either parsed object or string is accepted.

## Intentionally external / environment-dependent checks
These require the live deployment and cannot be truthfully certified before the external service is connected:
- Real Supabase database round-trip.
- Vercel production environment variables.
- Actual iPhone notification/background behavior (browser/PWA-dependent).
- Audible autoplay on a brand-new browser profile (browser policy-dependent).

The tracker degrades safely to local/offline mode when cloud sync is not configured.
