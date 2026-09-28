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
