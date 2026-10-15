# Render hosting preparation

This is a single-instance pilot deployment. The app/embedded worker, private WAHA, and private Temporal services use Starter instances and one 1 GB disk for each private service. Existing Tiger storage is reused. Do not start a second API/worker against the same workspace during cutover.

## Before provisioning

1. Keep the GitHub repository private while preparing it. Connect that repository to a Render Blueprint using `render.yaml`; do not enable preview deployments for the live database or channel credentials.
2. Add OPENROUTER_API_KEY to local `.env` and verify hosted Gemma extraction, drafts and validation before considering inference ready. The configured model IDs end in `:free`; application configuration rejects paid IDs. Free endpoints still have shared request limits and availability constraints.
3. Run `node_modules/.bin/node --env-file-if-exists=.env --import tsx scripts/prepare-render-secrets.ts`. It writes ignored mode-0600 secret files under `data/deploy/`, does not upload anything and never prints secret values. Do not commit these files.
4. This preserves the EXISTING Telegram encryption key because encrypted sessions already live in Tiger. A new unrelated key cannot read those sessions. Retain a secure backup. The helper assumes the default local `data/` path; if DATA_PATH was customized, migrate its existing key explicitly.
5. The app secret file includes TIGER_CA_BASE64 derived from the trusted local certificate. This takes precedence over TIGER_CA_PATH and preserves certificate/hostname verification without depending on a laptop filesystem path.
6. Supply SENTRY_DSN if trace evidence is required; a blank value leaves export disabled. Hosted Telegram requires its app ID/hash and the preserved SESSION_ENCRYPTION_KEY.

## Deployment values

- App: import values from `data/deploy/render-app.env`. Set APP_ORIGINS to the exact HTTPS `onrender.com` origin initially; add the custom domain's exact HTTPS origin when provided. Values must match the browser's Origin header, without trailing slashes.
- WAHA: import `data/deploy/render-waha.env`, supplying WHATSAPP_HOOK_URL as `https://<app-host>/api/webhooks/waha`. Its API and HMAC keys must match the app's corresponding values.
- Blueprint references supply private WAHA and Temporal addresses. The API and connectors listen privately/publicly according to their Render service types. Do not expose WAHA or Temporal directly to the internet.
- Temporal exposes private gRPC on port 7233; its HTTP API listens on Render's assigned PORT (10000), preventing HTTP port autodetection from redirecting gRPC traffic. Set TEMPORAL_ADDRESS to the private Temporal hostname with :7233 when using the API deployment; do not use its HTTP hostport.
- Both private services need persistent writable disks. Temporal is the SQLite development-server deployment for this controlled pilot, not a production HA cluster.
- The application Dockerfile preloads and verifies the MiniLM embedding model at build time, using EMBEDDING_CACHE_PATH. Gemma itself is hosted by OpenRouter, not inside the Render app container.

## Cutover and verification

Stop the local API/embedded worker before the hosted API first starts using these existing workspaces. Leave local data and volumes intact. Existing encrypted Telegram sessions can restore with the preserved key. WhatsApp credentials live in a separate local WAHA volume; expect to link the new hosted WAHA session by QR rather than assuming they migrated with Tiger. Current schedules are in Tiger and are re-enqueued; review or cancel obsolete approvals before cutover.

After deploy: health endpoint 200; HTTPS login; database reads/writes; Telegram restore; WhatsApp pairing/verified number; allowed-client ingestion in both directions; automatic tasks/calendar; reviewed sends; follow-up pause; one approved scheduled send; app restart with preserved tasks and connections. Confirm Sentry events if configured. Repeat using the .tech origin after its DNS/HTTPS setup.

## Budget review before creating services

Render currently lists Standard compute at $25/month and Starter at $7/month. The approved demo configuration uses three Starter instances: $21/month in compute plus $0.50/month for two 1 GB disks, approximately $10 over 14 days if prorated. The app has 512 MB RAM; no peak-load test was requested. This excludes disk, build, bandwidth, workspace-plan fees and any upgrades. Check the actual Blueprint checkout against the remaining $50 credit and its expiry before starting it. Tiger uses its separate existing credits. Keep a reserve for memory upgrades rather than promising an unmeasured two-week total.

[Render compute comparison](https://render.com/articles/render-vs-railway) · [Blueprint reference](https://render.com/docs/blueprint-spec) · [Persistent disks](https://render.com/docs/disks)

OpenRouter's documented free-model limits are 50/day and 20/minute without the qualifying credit purchase, or 1,000/day after a $10 credit purchase. The requests to free models remain zero-priced; the purchase is optional for the initial trial and must not be made automatically. Repairs/drafts use requests too. Verify the actual key's free_model_daily_requests using its key endpoint before launch. More keys do not increase account limits.

[OpenRouter free-model limits](https://openrouter.ai/blog/tutorials/how-to-get-the-lowest-cost-llm-inference-on-openrouter/) · [Current limit API](https://openrouter.ai/docs/api_reference/limits)

## Current preflight result

Native AMD64 container verification passed in [GitHub Actions](https://github.com/Nivin-Sithija/followthrough/actions/runs/38674034084): image build, 80 tests, and offline embedding inference. WAHA's pinned image manifest supports Linux AMD64. Render API authentication succeeds and Blueprint validation now passes after billing setup. The owner approved the revised three-Starter demo plan plus two 1 GB disks on 15 October 2026. GitHub repository access was granted. All three services have been created and are live; full hosted acceptance checks are pending.

The app is live at `https://followthrough.onrender.com` on Starter. All three services are live. The hosted root page, favicon, health endpoint and signed-out account endpoint return 200; protected `/api/state` returns 401 without a session. The local API/worker was stopped before cutover. The owner confirmed login and both channel connections on the hosted app. Hosted message/calendar acceptance checks remain pending.

The selected custom domain is `scheduleup.tech`, added to Render together with its www redirect. Its authoritative nameservers are the `.tech domains` OrderBox nameservers. Required DNS: apex A `216.24.57.1`; www CNAME `followthrough.onrender.com`. Render verified both domains, and Google Public DNS returns the expected apex A and www CNAME records. HTTPS certificate activation remains pending; direct TLS checks still failed immediately after verification.

OpenRouter's free Gemma endpoint still returned HTTP 429 on the latest small inference check. A valid key and unused personal quota do not establish provider availability; hosted AI acceptance checks remain pending.
