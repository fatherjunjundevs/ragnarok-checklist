# Ragnarok: The New World Tracker v5.4.0

A mobile-first / desktop-friendly PWA quest tracker for a UTC+7 Ragnarok server with daily reset at 5:00 AM and weekly reset Monday at 5:00 AM.

## Major features

1. Automatic cloud-sync engine for phone ↔ PC pairing (Vercel API + Supabase table).
2. Sticky quick bar with character switch, daily/weekly progress, reset countdown, filters, and Finish Before Reset mode.
3. Hide completed, collapse Dailies/Weeklies/categories, and optional completed-to-bottom sorting.
4. Multi-character profiles with job/class, portrait emoji, quick switching, and quest-setup copying.
5. Quest categories with custom categories and drag-to-reorder / drag-between-category support.
6. Optional reset reminders using browser notifications while the app is active/PWA-supported.
7. Daily and weekly completion history with a 35-day calendar and streak counter.
8. Responsive desktop two-column dashboard and mobile single-column layout.
9. Service-worker update banner with “Update now”.
10. Separate HTML/CSS/JS/music/art assets for smaller HTML and easier maintenance.
11. Automatic local snapshots plus restore, JSON export/import, and manual sync-code fallback.
12. Ragnarok-inspired visual polish, Prontera artwork/music, compact mode, and optional UI sounds.
13. Per-quest notes.
14. Favorites and priority levels (Normal, Low, High, Urgent).
15. Finish Before Reset mode that hides completed quests and prioritizes favorites/urgent work.
16. Appearance control with Light, Dark, and Device themes, plus a one-click theme switch in the header.
17. RPG-style category icons, richer progress/status cards, and per-character accent colors.
18. Mobile bottom navigation and a lightweight completion celebration for faster, more satisfying everyday use.
19. Compact everyday header and a two-row mobile quick toolbar so quests appear sooner and core controls do not scroll offscreen.
20. Organize mode with lifted/floating drag cards for clearer drag-and-drop quest reordering.
21. Optional quest run counters with automatic completion at the target.
22. All-character progress overview for quickly spotting unfinished dailies and weeklies.
23. Short-session planner that suggests unfinished quests for 15–120 minute play windows using priorities, favorites, and editable duration estimates.
24. Optional quest guidance for prerequisites, location, rewards, and notes behind an expandable details control.

## Appearance

Choose **Device setting**, **Light mode**, or **Dark mode** in Settings. A quick header button switches between Light and Dark. The preference is saved with tracker state and can sync across paired devices.

## Existing-data migration

The app reads the previous local-storage keys (`ragnarok-new-world-checklist-v3` and v1) and migrates characters, quest checks, custom quests, and quest ordering into the v5 state model. Existing `Monster Etermination` data is corrected to `Monster Extermination`.

Existing profiles upgrading from releases before v5.1.3 receive **Elite** once under the **Hunt** daily category if it is missing, without resetting the rest of their quest progress.

v5.4 automatically gives existing quests a target of **1**, preserves completed/unfinished state as counter progress, uses a default **10-minute** duration estimate, and leaves the new guidance fields blank until the player adds them. No Supabase schema migration is required. After a cloud room has been updated by v5.4, older tracker clients are prevented from overwriting the newer quest fields; update all paired devices when the v5.4 service-worker prompt appears.

## Creator

Ragnarok: The New World Tracker is an unofficial fan-made community project created by **FatherJunJun**.

The tracker was created to help players manage daily quests, weekly activities, multiple characters, resets, notes, priorities, and progress across devices.

## Support the Tracker

The tracker is free to use.

If you enjoy the project and would like to support future updates and maintenance, you can support FatherJunJun through Buy Me a Coffee:

**https://buymeacoffee.com/FatherJunJun**

Support is completely optional and does not unlock or restrict tracker functionality. Payments are handled by Buy Me a Coffee; the tracker does not collect payment-card information.

## Disclaimer

This is an unofficial fan-made community project and is not affiliated with or endorsed by the game publisher or developer.

## Privacy & Security

v5.2 adds a security-hardening layer around the tracker and optional cloud sync:

- Database-backed rate limiting for sync traffic, room creation, credential rotation/revocation, and failed authentication attempts.
- Server-generated high-entropy room IDs and pairing secrets for new cloud pairings.
- Generic cloud authentication failures so an attacker cannot distinguish a missing room from a wrong secret.
- Pairing-code rotation and full cloud revocation.
- Strict server-side validation of tracker state before it is stored.
- Content Security Policy (CSP), clickjacking protection, HSTS, strict referrer policy, and additional security headers.
- Supabase RLS with no public policies for tracker and rate-limit tables.
- A public `/privacy.html` page describing what is stored locally and in cloud sync.

The cloud pairing code should be treated like a password. If it may have been exposed, use **Rotate pairing code**. To invalidate the cloud room for every device and delete its cloud copy, use **Revoke pairing everywhere**. Local tracker data on the current device remains available.

The pairing credential is stored separately in browser localStorage so automatic sync can continue across browser restarts. It is not included in exported tracker JSON backups. CSP and other browser protections reduce the risk of same-origin script injection, but no client-side storage mechanism can make a secret inaccessible to malicious code that is already running with full same-origin privileges.

## Cloud sync setup (one-time)

The front-end and API are already included. To turn cloud sync from “Setup needed” to “Ready”:

1. Create/connect a Supabase project.
2. Run `supabase_setup.sql` in the Supabase SQL editor.
3. In Vercel → project → Settings → Environment Variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (mark sensitive; never put it in browser code)
4. Redeploy the Vercel project.
5. Open the tracker on device 1 → Cloud Sync → Create pairing. Copy the private pairing code.
6. Open device 2 → Cloud Sync → Join with code.

The pairing code is effectively a password. The secret is sent only over HTTPS to the Vercel API and stored in Supabase only as a SHA-256 hash. The Supabase table has RLS enabled and no public policies; the service role is server-only.

## Deployment

The production source lives in `Ragnarok_Tracker_v5_Greatest_Tracker/`, which is configured as the Vercel Root Directory. Update files inside that folder and preserve the `assets/` and `api/` subfolders. Do not create another nested tracker folder.

Files that must be present:

- `index.html`
- `assets/app.css`
- `assets/app.js`
- `assets/theme-init.js`
- `assets/prontera.webp`
- `assets/prontera.mp3`
- `api/health.js`
- `api/sync.js`
- `privacy.html`
- `icon-192.png`
- `icon-512.png`
- `manifest.webmanifest`
- `sw.js`
- `vercel.json`
- `package.json`
- `supabase_setup.sql`

## Reset rules

- Server timezone: UTC+7 (Indochina Time)
- Daily reset: every day at 05:00 UTC+7
- Weekly reset: Monday at 05:00 UTC+7

## Audio behavior

v5.2.1 uses direct HTML audio playback for the Prontera theme so user taps can satisfy Safari/iPhone/PWA media rules more reliably. On the first music-enabled visit, the tracker shows a **Welcome, adventurer** choice with **Enter with Music** or **Enter Quietly**. On later visits it can try autoplay when enabled; if the browser blocks it, the tracker shows a visible **Tap to enable music** control and also retries on the next eligible pointer/keyboard interaction. Quest UI confirmation sounds remain separate.

## Reminder limitation

The included reminder system can show browser/PWA notifications while the tracker is active and when the platform keeps its service worker available. Guaranteed scheduled background push while the app is fully closed would require a push-subscription backend and is not claimed by this version.

## Recent fixes

### v5.4.0 — Everyday Questing upgrade

- Compacted the header and converted Prontera music controls into a small expandable player so quests appear sooner.
- Rebuilt the mobile quick toolbar into two non-scrolling rows with character/reset/progress and everyday filters always visible.
- Added **Organize mode**: edit/reorder controls stay out of the normal checklist and dragged quest cards visibly lift/follow the pointer while moving.
- Rebalanced desktop layout so Dailies get the primary column and Weeklies share a compact sidebar with character overview and session planning.
- Added optional run counters (`1 / 3`, etc.) with +/- controls and automatic completion when the target is reached. Counters reset with the server period.
- Added an all-character overview showing daily/weekly completion and remaining work, with one-tap character switching.
- Added a short-session planner for 15, 30, 45, 60, 90, or 120 minutes using editable quest duration estimates, priorities, and favorites.
- Added optional quest guidance fields for prerequisites, location, rewards, and notes behind an expandable Quest details control.
- Extended cloud-sync server validation for the new counter, duration, and guidance fields without requiring a Supabase schema change.
- Preserved v5.2 security hardening, UTC+7 / 5:00 AM resets, the iOS drag fix, and the v5.2.1 Enter with Music behavior.

### v5.3.0 — Adventure UI upgrade

- Added RPG category icons and category-level completion counters.
- Added richer server/reset/connection status cards and reset urgency styling.
- Added percentage progress badges, enhanced progress bars, and completion styling.
- Added per-character accent colors.
- Added a lightweight completion celebration.
- Simplified Cloud Sync and Backups controls with expandable advanced/security sections.
- Reorganized Settings and added direct shortcuts to cloud, backups, and reminders.
- Added a mobile bottom navigation for faster one-handed use.

### v5.2.1 — Music & convenience fixes

- Fixed first-interaction music startup and activated the Welcome music-choice flow.
- Added a visible fallback when autoplay is blocked.
- Added iPhone/iPad Add to Home Screen guidance.
- Kept Favorite visible on mobile.
- Replaced Cloud Join's browser prompt with a proper pairing modal.

### v5.2.0 — Security hardening

- Added durable Supabase-backed API rate limiting and abuse controls.
- Added pairing-code rotation and all-device revocation.
- Added strict cloud-state validation and generic authentication errors.
- Added CSP, HSTS, clickjacking protection, and additional security headers.
- Added `/privacy.html` with storage, cloud-sync, pairing-code, and payment-link disclosures.
- Minimized and validates the locally persisted cloud credential object.

### v5.1.4 — FatherJunJun Branding + Support

- Added FatherJunJun creator attribution across the tracker.
- Added Buy Me a Coffee support, QR support modal, and sharing controls.
- Added About the Creator and fan-made project disclaimer content.
- Updated page/PWA metadata and service-worker cache for v5.1.4.

### v5.1.3 — Hunt update

- Added **Elite** to the default **Hunt** daily category alongside MVP and Mini.
- Existing v5 profiles automatically receive Elite once when first opened on v5.1.3, without resetting completion state for other quests.
- Includes the v5.1.2 iOS drag text-selection fix.

### v5.1.2 — iOS drag fix

Quest drag handles suppress iOS text selection, touch callouts, and selection ranges while a reorder gesture is active. Normal page text remains selectable when not dragging.

### v5.1.1 — Modal fix

Modal close controls are explicit non-submit buttons. This prevents required form fields (such as a blank character name) from blocking the × and Cancel controls. Escape/Cancel events also close the dialog explicitly.
