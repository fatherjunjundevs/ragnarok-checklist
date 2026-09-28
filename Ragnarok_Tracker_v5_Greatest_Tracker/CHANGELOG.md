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
