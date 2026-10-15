# Security and delivery

ScheduleUp treats messages, retrieved text, templates and model output as untrusted data. Gemma receives a data envelope and explicit instruction boundaries. Deterministic evidence, ownership, date, revision and completion checks still decide whether tasks can be committed. Suspicious instruction or script patterns route changes to owner review; unsafe generated drafts and unsupported output fields are rejected. The model has no sending tools or credentials. Drafts require the owner's send action.

These controls reduce risk; pattern detection cannot identify every encoded, multilingual or novel prompt injection. Original conversations are retained as text. React escapes displayed content; the UI does not execute message HTML. Hosted responses restrict scripts to same-origin files, forbid framing and objects, and apply HSTS, MIME and referrer protections. QR images remain supported through data URLs.

Unsafe dashboard requests require a dashboard header and a trusted origin when present. The renamed header is `X-ScheduleUp`; the legacy header remains accepted for cached clients. Signed WAHA webhooks use their own authentication. Existing account isolation, hashed sessions, serialized scrypt password hashing, channel allowlists and encrypted Telegram sessions remain in force.

## Limits

| Scope | Limit |
|---|---|
| API source IP, excluding health | 300 requests/minute |
| Account writes | 60/minute |
| Account AI drafts/retries | 6/minute |
| Account sends/schedules | 12/minute |
| Account connection actions | 10/minute |
| Workspace analysis | 40/15 minutes |
| Request body | 64 KiB |
| Pending password hashes | 4 |
| Pending model calls | 16; reject queue waits over 120 seconds |

Quota responses use HTTP 429 and `Retry-After`. Counters are bounded, in-process and reset on restart; distributed counters are required before horizontal scaling. Existing authentication throttling also applies. Analysis quota failures preserve input for retry. No bulk load testing is claimed.

## CI/CD

`.github/workflows/ci.yml` builds and type-checks, runs regressions and fails on high/critical production dependency advisories. Main also builds the Linux container, runs its tests without network and verifies the bundled embedding model offline. Actions are pinned to commit SHAs; checkout credentials are not persisted. Pull requests receive no Render credentials and cannot deploy.

Only successful main checks reach the serialized Render deployment job. Configure repository secret `RENDER_API_KEY`; the script verifies the service/repository and current main revision before cutover. It suspends the previous embedded worker before resume, verifies the exact checked commit, and attempts rollback to the previous live revision on failure. This single-worker pilot accepts brief deployment downtime to avoid overlapping Telegram sessions. Rollback failure requires operator inspection; GitHub reports it as a failed job. Render's independent auto-deploy stays disabled.

The audit currently has five moderate production advisories and no high/critical advisories. No major dependency upgrades were forced.

## Branding and mobile navigation

The app and documentation use ScheduleUp. Existing repository URLs, Render hostnames, database/schema identifiers, session cookie and Temporal task queue identifiers remain compatible with saved accounts and workflow histories. They are infrastructure identifiers rather than product branding.

At phone widths (700 px and below), a fixed hamburger opens the sidebar without a top navigation bar. The drawer supports dismissal, Escape, focus containment, background scroll locking and automatic closure on navigation. Cards, calendar, conversations and forms use compact responsive layouts. Device emulation is a preview, not a guarantee for every browser or physical device.
