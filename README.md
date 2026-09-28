# Ragnarok: The New World Checklist — Website/PWA

This folder is a deploy-ready static Progressive Web App.

## Included
- Daily reset at 5:00 AM UTC+7
- Weekly reset Monday at 5:00 AM UTC+7
- Drag/touch/keyboard quest reordering
- Multiple character profiles
- Embedded Prontera music
- Offline mode through a service worker
- Install-to-home-screen support
- Manual sync code and JSON backup/restore
- Responsive phone + desktop layout

## Deploy on Vercel
Upload this folder as a static project. No build command is required. The entry file is `index.html`.

## Cross-device automatic cloud sync
The current build intentionally keeps account data local, with manual sync codes/backups. True automatic phone ↔ PC synchronization needs a database and sign-in layer. That can be added after the site is connected to a deployment/backend provider.
