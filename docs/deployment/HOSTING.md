# Hosted operations

Inventory verified through the Render API on **15 October 2026**.

| Service | ID | Runtime | Instance/disk |
|---|---|---|---|
| Schedule-Up | `srv-db86s52j9qps73bsojdg` | Docker web app, API, embedded worker and GramJS | 1 Starter instance |
| followthrough-waha | `srv-db84oh0m7kps73d2cltg` | Private WAHA image | 1 Starter instance; 1 GB session disk |
| followthrough-temporal | `srv-db84of3ncjis73ekj0t0` | Private Temporal Docker service | 1 Starter instance; 1 GB SQLite history disk |

All services are in Singapore and were unsuspended with live deployments. No additional Render services appeared in the inventory. Previous deployments were deactivated/canceled. The public app's current revision was `9b14beb3004301f296f2222e1902fbc11eeb7568`, matching the repository at audit time. Documentation edits after that audit are not claimed as deployed.

## Addresses and dependencies

- Product: https://scheduleup.tech
- Render app alias: https://schedule-up.onrender.com (same service, not a duplicate deployment).
- WAHA internal address: `followthrough-waha:10000`.
- Temporal gRPC: private hostname on port `7233`; its HTTP API uses Render's assigned `PORT`.
- Tiger Data PostgreSQL and OpenRouter are external dependencies.

`render.yaml`, `Dockerfile` and `infra/` define the service setup. The Temporal entrypoint fixes gRPC at 7233 and HTTP at assigned `PORT`, avoiding HTTP autodetection of a random port. Do not expose either private service publicly.

## Application configuration

Production uses `NODE_ENV=production`, `HOST=0.0.0.0`, `AI_PROVIDER=openrouter`, `STORE_DRIVER=postgres`, `DURABLE_MODE=temporal` and `WHATSAPP_PROVIDER=waha`. PostgreSQL and Temporal are required at production startup.

Required secret/config groups:

| Group | Variables |
|---|---|
| Inference | `OPENROUTER_API_KEY`; optional explicit primary/fallback model IDs |
| Database | `TIGER_DATABASE_URL`, trusted `TIGER_CA_BASE64` or `TIGER_CA_PATH` |
| Private endpoints | `TEMPORAL_HOST` or `TEMPORAL_ADDRESS`; `WAHA_HOSTPORT` or `WAHA_URL` |
| WhatsApp | Matching `WAHA_API_KEY` and webhook HMAC keys; WAHA hook URL points to `/api/webhooks/waha` |
| Telegram | `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, stable 64-hex-character `SESSION_ENCRYPTION_KEY` |
| Browser origins | `APP_ORIGINS` lists the exact permitted HTTPS origins |

Verified origins include `https://scheduleup.tech`, `https://www.scheduleup.tech` and `https://schedule-up.onrender.com`. Never commit secret values. Preserve the encryption key across deployments; changing it prevents reading saved Telegram sessions. Keep provider session disks and database backups with the corresponding encryption key.

The Docker build packages the embedding model. Gemma inference remains external. Current model availability is recorded in [validation](../testing/VALIDATION.md).

## Release and rollback

GitHub Actions builds, type-checks, tests and audits dependencies. Main also verifies the Linux container and offline embedding inference before the serialized deploy job. Render independent auto-deploy is disabled. GitHub uses secret `RENDER_API_KEY` and variable `RENDER_SERVICE_ID`.

`scripts/deploy-render.mjs` checks the repository/current main revision and existing deployment status. It suspends the previous app before resuming, pins the verified commit when needed, polls for live status, and attempts rollback to the previous live revision on failure. This pilot accepts brief downtime to avoid overlapping Telegram owners. Keep one API with its embedded worker; do not add a standalone send worker or another API using these sessions.

After a release, verify HTTPS/assets, sign-in, account state, primary and fallback inference, allowed-message ingestion, task evidence/calendar, approved sends and follow-up pause. Channel connection and recovery checks require an authenticated workspace; an HTTP 200 health response is only liveness.

## Incident checks

Check Render instance counts, active deployments and current logs first. Probe inference independently from `/api/health`; inspect database connectivity separately. Preserve uncertain sends for manual inspection in the messaging app. Avoid restarting services during an active send just to test recovery. Private services being live does not establish that an account is paired or that messages are delivered.

No current pricing estimate or credit balance is asserted here; use the account's billing page for actual charges.
