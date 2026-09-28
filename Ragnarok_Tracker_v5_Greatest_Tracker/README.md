# Ragnarok: The New World Tracker v5.1.2

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

## Appearance

Choose **Device setting**, **Light mode**, or **Dark mode** in Settings. A quick header button switches between Light and Dark. The preference is saved with tracker state and can sync across paired devices.

## Existing-data migration

The app reads the previous local-storage keys (`ragnarok-new-world-checklist-v3` and v1) and migrates characters, quest checks, custom quests, and quest ordering into the v5 state model. Existing `Monster Etermination` data is corrected to `Monster Extermination`.

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
- `assets/prontera.webp`
- `assets/prontera.mp3`
- `api/health.js`
- `api/sync.js`
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

The app attempts autoplay when the user preference is enabled. Browsers may block audible autoplay. If blocked, the first pointer/keyboard interaction attempts to unlock and start the music automatically. Volume uses a Web Audio gain node when available, with normal media-element volume as fallback.

## Reminder limitation

The included reminder system can show browser/PWA notifications while the tracker is active and when the platform keeps its service worker available. Guaranteed scheduled background push while the app is fully closed would require a push-subscription backend and is not claimed by this version.


## v5.1.1 modal fix

Modal close controls are explicit non-submit buttons. This prevents required form fields (such as a blank character name) from blocking the × and Cancel controls. Escape/Cancel events also close the dialog explicitly.


## v5.1.2 iOS drag fix

Quest drag handles now suppress iOS text selection, touch callouts, and selection ranges while a reorder gesture is active. Normal page text remains selectable when not dragging.
