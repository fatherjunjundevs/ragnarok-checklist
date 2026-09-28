# Security — Ragnarok: The New World Tracker v5.2.0

This document describes the security model for the unofficial fan-made tracker created by **FatherJunJun**.

## Application controls

- Cloud sync is server-mediated. The browser does not receive the Supabase service-role key.
- `tracker_states` and `sync_rate_limits` have Row Level Security enabled with no public policies.
- Pairing secrets are stored in Supabase only as SHA-256 hashes.
- New room IDs and pairing secrets are generated server-side with cryptographically secure randomness.
- `/api/sync` uses database-backed request limits for general traffic, room creation, room traffic, failed authentication, credential rotation, and revocation.
- Missing rooms and incorrect secrets return the same authentication error.
- Cloud payloads are size-limited and schema-validated before storage.
- Pairing codes can be rotated. Cloud rooms can be revoked/deleted for all devices.
- CSP blocks inline scripts and limits executable resources to the same origin.
- `frame-ancestors 'none'` and `X-Frame-Options: DENY` block clickjacking.
- HSTS, no-sniff, no-referrer, Permissions Policy, COOP, CORP, and related headers are set at the deployment layer.
- The local cloud credential is stored separately from tracker state and excluded from exported JSON backups.

## Pairing-code threat model

A pairing code is a bearer credential. Anyone with a valid code can access the associated cloud room. Users should treat it like a password and avoid posting it in screenshots or public chat.

If a code may have been exposed, use **Rotate pairing code**. This invalidates the previous code immediately. Other devices must join again with the new code.

Use **Revoke pairing everywhere** to delete the cloud room and invalidate the pairing for all devices. Local tracker data remains on the current device.

## Local storage

The tracker uses browser localStorage for tracker state and, when cloud sync is enabled, the cloud credential. CSP reduces the risk of script injection, but localStorage is not a secure hardware vault and is accessible to JavaScript that successfully runs in the same origin. For this reason, the project minimizes what is stored with the credential and never puts the Supabase service-role key in browser code.

## Manual account-security checklist

These controls cannot be enabled by application code and should be verified by the project owner:

- [ ] GitHub account: enable 2FA or a passkey.
- [ ] Vercel account/team: enable 2FA or a passkey where available.
- [ ] Supabase account: enable MFA.
- [ ] GitHub `main` branch: protect against force pushes and deletion; consider requiring pull requests once the deployment workflow is comfortable.
- [ ] Keep Vercel environment variables secret and never commit `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Review account sessions and remove devices/integrations that are no longer trusted.

## Security QA before release

- [x] JavaScript syntax checks for frontend, service worker, health endpoint, theme initializer, and sync API.
- [x] JSON validation for Vercel, manifest, and package configuration.
- [x] CSP-compatible startup: inline startup script removed.
- [x] Supabase rate-limit migration applied successfully.
- [x] Supabase function EXECUTE permission verified: `service_role=true`, `anon=false`, `authenticated=false`.
- [x] RLS verified on `tracker_states` and `sync_rate_limits`.
- [x] Supabase Security Advisor rerun after database changes.
- [x] Generic authentication-response behavior covered by API QA tests.
- [x] State-validation, rate-limit, rotation, revocation, and create-flow behavior covered by API QA tests.
- [ ] Account-level MFA/passkey and branch-protection settings verified by the project owner.

## Reporting a security problem

Do not publish pairing codes, service-role keys, or other secrets in a public issue. If a pairing code is exposed, rotate or revoke it immediately from the tracker.
