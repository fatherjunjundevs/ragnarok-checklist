# v5.4.3 — Precise Drag & Character Copy

- Anchored the floating drag shell with real fixed `left`/`top` coordinates at the source row, so the card cannot flash or fly in from the top even if a browser delays compositor transforms.
- Removed drag-follow interpolation so the floating card stays directly attached to the latest mouse/touch position while still updating through `requestAnimationFrame`.
- Uses the dragged card center for drop-slot decisions to make reordering feel more natural and reduce jumpy slot changes.
- Replaced the browser-prompt Copy Setup flow with a proper character-to-character modal.
- Copy Setup now explicitly shows **Copy from** and **Copy to**, previews the transfer, explains what is copied, and makes clear that destination completion progress resets.
- Bumped application, API health, assets, and service-worker cache to v5.4.3.

# v5.4.2 — Silky Organize Drag Polish

- Fixed the iPhone/iPad one-frame jump where a dragged quest could briefly appear from the top-left before snapping under the finger.
- Positioned the floating quest synchronously at its source row before the browser can paint it.
- Split drag translation from the visual lift animation so scaling/shadows no longer fight pointer tracking.
- Added light frame-to-frame interpolation for touch movement while keeping the card closely anchored to the finger.
- Uses the latest coalesced pointer sample when available for smoother touch tracking.
- Disabled smooth page scrolling during active drag so edge auto-scroll does not queue competing scroll animations.
- Reduced drag-list layout work between pointer samples and shortened row reflow animation timing.
- Added a short settle animation into the visible drop slot before the real quest row is restored.
- Preserved v5.4.0 counters, planner, guidance, overview, cloud validation, and all existing v5.2 security protections.

# v5.4.1 — Smooth Organize Drag Patch

- Rebuilt Organize-mode dragging around a lightweight drop slot instead of moving the full quest row on every pointer event.
- Removed the duplicate-looking translucent source row while dragging; the original quest is hidden and its destination is shown as a clear dashed drop slot.
- Moved the floating quest card with GPU-friendly `translate3d()` updates scheduled through `requestAnimationFrame` for smoother pointer tracking.
- Simplified the floating card so it shows the quest identity without duplicated Favorite/Edit/counter controls.
- Added gentle FLIP-style movement for neighboring quest rows as the drop slot changes position.
- Added smoother edge auto-scroll and clearer category highlighting while moving quests between categories.
- Preserved v5.4 counters, planner, guidance, cloud validation, and all earlier security/reset/music fixes.
- Bumped front-end assets, API health, and service-worker cache to v5.4.1.

# v5.4.0 — Everyday Questing Upgrade

- Compacted the hero/header so checklist content appears sooner on desktop and mobile.
- Converted the Prontera music controls into a compact expandable player while preserving the working Enter with Music flow.
- Rebuilt the mobile quick controls as two non-scrolling rows so character, reset, filters, Finish mode, and Organize mode stay reachable.
- Added Organize mode so drag handles and Edit controls stay hidden during normal questing.
- Added a lifted floating-card drag effect for more natural drag-and-drop reordering and category moves.
- Allowed quest names to wrap to two lines and made the checkbox/name area easier to tap.
- Rebalanced desktop layout with a wider Dailies column and a narrower sidebar for Weeklies, roster overview, and session planning.
- Added optional quest run counters with +/- controls and automatic completion at the target.
- Added editable quest duration estimates and reset-safe counter migration for existing tracker data.
- Added an all-character overview with daily/weekly progress and remaining counts.
- Added a short-session planner for 15–120 minute play windows.
- Added optional quest guidance fields for prerequisites, location, rewards, and notes behind expandable details.
- Extended cloud-sync validation for counter, duration, and guidance fields; no Supabase schema change is required.
- Added a cloud downgrade guard so an older client cannot overwrite v5.4 quest-counter/guidance data after a room has been upgraded.
- Preserved v5.2 security hardening, v5.2.1 music behavior, Elite, UTC+7 reset logic, and iOS drag protections.
- Bumped application, API health, assets, and service-worker cache to v5.4.0.

# v5.3.0 — Adventure UI Upgrade

- Added RPG-style category icons and per-category completion counters.
- Upgraded server time, reset, and connection cards with clearer visual status and reset urgency.
- Added percentage badges, animated progress bars, and completed-card styling for Dailies and Weeklies.
- Added per-character accent colors that persist in local backups and cloud sync.
- Added a lightweight quest-completion celebration that respects reduced-motion preferences.
- Simplified Cloud Sync by keeping everyday actions visible and moving pairing/security controls into a Manage section.
- Simplified Backups & Restore and moved manual sync codes into Advanced transfer tools.
- Reorganized Settings into Appearance, Gameplay, Sound, Categories, Data & tools, and About sections.
- Added a mobile bottom navigation for Today, Weekly, Character, and More.
- Preserved v5.2 security hardening and the v5.2.1 music playback fixes.
- Bumped application, API health, assets, and service-worker cache to v5.3.0.

# v5.2.1 — Music & Convenience Fixes

- Activated the existing Welcome, Adventurer music-choice screen and wired Enter with Music / Enter Quietly behavior.
- Reworked theme playback to call the HTML audio element directly from user gestures for better Safari/iPhone/PWA compatibility.
- Added a visible “Tap to enable music” fallback when a browser blocks autoplay.
- Removed the unnecessary Web Audio routing layer from background music while keeping quest UI sound effects independent.
- Added clearer playing, paused, blocked, and load-error music states.
- Added an iPhone/iPad Add to Home Screen helper modal and made the install control discoverable on iOS.
- Kept the Favorite star visible on mobile quest rows.
- Replaced the Cloud Join browser prompt with a styled pairing modal, paste helper, and pairing-code safety reminder.
- Bumped application, API health, assets, and service-worker cache to v5.2.1.

# v5.2.0 — Security Hardening

- Added database-backed rate limiting for sync traffic, room creation, credential rotation/revocation, and failed authentication attempts.
- Cloud rooms are now created only through a dedicated rate-limited `create` action with server-generated 128-bit room IDs and 256-bit pairing secrets.
- Added pairing-code rotation and full cloud-pairing revocation controls.
- Made missing-room and incorrect-secret authentication failures indistinguishable to reduce room-ID enumeration.
- Added strict server-side validation for tracker profiles, tasks, categories, settings, history, metadata, and payload size.
- Added Content Security Policy (CSP), clickjacking protection, HSTS, stricter referrer policy, and additional browser security headers.
- Moved startup theme logic to an external script so `script-src 'self'` can block inline script execution.
- Minimized the cloud credential object stored in browser localStorage and validate it before use.
- Added a Privacy & Security page explaining local storage, cloud sync, pairing-code safety, rate limiting, payment links, and data controls.
- Added hashed-network-identifier rate-limit storage with RLS and service-role-only access in Supabase.
- Fixed service-worker navigation caching so the Privacy & Security page cannot overwrite the offline home-page cache.
- Bumped application, API health, PWA assets, and service-worker cache to v5.2.0.

# v5.1.4

- Added creator branding for FatherJunJun.
- Added a full-width Support the Tracker / About the Creator section.
- Added Buy Me a Coffee support at `buymeacoffee.com/FatherJunJun`.
- Added the creator's support QR code in a dedicated support modal.
- Added Copy Support Link and Share Tracker actions.
- Added creator attribution and an unofficial fan-made project disclaimer to the footer.
- Added creator/about controls inside Settings.
- Updated page metadata, sharing metadata, and PWA description with FatherJunJun creator attribution.
- Bumped app, API health, assets, and service-worker cache to v5.1.4.

# v5.1.3

- Added Elite to the Hunt daily category alongside MVP and Mini.
- Added a one-time migration so existing character profiles receive Elite without losing current quest progress.
- Includes the v5.1.2 iOS drag text-selection fix.

# v5.1.2

- Fixed iOS Safari selecting/highlighting quest text while dragging to reorder.
- Suppressed iOS touch callouts and selection only during active drag operations.
- Added selection cleanup during pointer movement without disabling normal page text selection.
- Bumped service-worker and asset cache versions so iPhones receive the fix.

# v5.1.1

- Fixed Character dialog × and Cancel buttons being blocked by required-field validation.
- Applied the same explicit close behavior to tracker dialogs for consistency.
- Bumped PWA cache and asset version to force browsers to receive the bug fix.
- Updated documentation for the current Vercel Root Directory workflow.

# v5.1.0

- Added Device setting, Light mode, and Dark mode appearance options.
- Added a one-click Light/Dark switch in the hero header.
- Added dark-theme component styling.
- Added startup theme detection.
- Theme preference persists and participates in cloud/manual backups.
- Updated PWA cache and health version to 5.1.0.

# v5.0.0

- Rebuilt tracker into modular PWA assets.
- Added cloud pairing/sync API with optimistic revision conflicts.
- Added sticky quick controls and quick character switching.
- Added hide-completed, completed-to-bottom, section/category collapse.
- Added character class/avatar and setup-copy workflow.
- Added categories and cross-category drag ordering.
- Added reminder controls and notification support.
- Added completion history and streaks.
- Added responsive desktop two-column layout.
- Added service-worker update prompt.
- Added automatic restore snapshots.
- Added notes, favorites, priorities, and Finish Before Reset mode.
- Added optional UI sounds and improved browser-audio unlock behavior.
- Preserved UTC+7 / 5:00 AM reset logic and Monday weekly reset.
