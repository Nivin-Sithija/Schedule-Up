# FollowThrough

A WhatsApp and Telegram client workspace for commitments, dates, missing inputs and approved follow-ups. Both sides of the conversation inform the task tracker. AI proposes; deterministic application code validates and commits.

## Local development

The default is **Ollama + simulated WhatsApp + a file-backed local scheduler**. No OpenRouter key is used and no real messages are sent.

```sh
npm install
cp .env.example .env
ollama serve
npm run dev
```

In another terminal run `npm run ui` and open the printed Vite URL. The existing local model is configured as `gemma4:12b`. The project-local Node 22 package runs npm scripts; system Node should be 22.13+ for deployment.

Use Clients → Conversation simulator to enter a client request and an owner promise. Messages batch after five idle seconds (maximum fifteen seconds); inference may take longer on a local 12B model. Never silently switches local inference to a hosted API.

```sh
npm test
npm run build
npm run eval:local
```

The live evaluation currently contains four smoke scenarios, not the planned 40-case benchmark. Automated tests use no inference. Ollama must be running for live evaluation.

## Message architecture

Signed, allowlisted events → pause approved sends → Temporal signal recorded durably → per-client batch → Tiger PostgreSQL persistence and direct Gemma input in parallel → evidence/revision validation → task commit. Messages are not reread merely to reconstruct their model input. Context includes both speakers, at most 20 active tasks and 24,000 message characters. Model input includes message IDs once, not duplicated copies of new messages.

The local scheduler persists messages before returning and recovers unanalyzed messages on startup. It does **not** claim Temporal durability. Enable Temporal for durable workflow testing:

```sh
docker compose up -d temporal
```

Set `DURABLE_MODE=temporal` and restart the API. The API launches its activity worker; do not also run a second local file-store worker. Temporal uses a persistent SQLite development server; keep it private and do not call this a production Temporal installation.

## Real WhatsApp pilot

Set `WHATSAPP_PROVIDER=waha`, `WAHA_API_KEY` and `WAHA_WEBHOOK_HMAC_KEY`. Users register their own accounts, save their owner number in Settings, and manage allowed numbers on the Allowed clients page. Each account has a separate WAHA session. The API must bind to an address accessible to Docker for webhooks; use authenticated/private networking when binding beyond loopback.

```sh
docker compose --profile whatsapp up -d waha temporal
```

Dashboard Settings → Start connection creates the WAHA session if needed; Show pairing QR returns its image. Pair only the configured owner account. The connector checks that account identity before ingesting or sending messages. Validate the pinned image tags against your registry before running. QR linking is unofficial and can fail or result in account blocking, as accepted for this controlled prototype.

Unknown linked-device IDs are looked up through WAHA and accepted only when they map to an allowlisted client. Unresolved IDs are ignored rather than guessed. Allowlisted alias lookup is implemented but unverified against WAHA; historical backfill and complete delivery reconciliation are not finished; test them before using real client conversations. The connector currently captures live text only. Session credentials stay on a disk, never in the browser. No bulk sends or autonomous AI replies.

## Storage and retrieval

Set `STORE_DRIVER=postgres` and `TIGER_DATABASE_URL` to use Tiger for all application state and retrieval. MongoDB/Atlas has been removed. Each account has its own optimistic-CAS JSONB row in `ft_workspace`, capped at 12 MB. Indexed search chunks live in `ft_chunks_v2`, scoped by account and client; account hashes and hashed session tokens live in `ft_auth`. Use a dedicated database or schema (`followthrough_whatsapp_test` for this test). Larger usage requires normalized entity tables and archival. File mode is only for a single local simulator process.

`TIGER_CA_PATH` can point to a trusted certificate bundle. The application retains certificate and hostname verification; it does not disable TLS checks.

`TIGER_DATABASE_URL` enables pgvector + PostgreSQL English full-text search fused by reciprocal rank. Use a database dedicated to FollowThrough development/pilot; do not point at an unrelated project's database. The embedding model downloads on first use, so prewarm/package it before hosting. Retrieval failure falls back to current conversation context; old search results are checked against authoritative workspace messages. Without Tiger, only the file-backed simulator is available.

## Hosting

`render.yaml` is an unprovisioned scaffold for the API/worker, private WAHA and private Temporal. The API also serves the built frontend, reducing separate deployment setup. Configure your domain and set `APP_ORIGINS` to its exact HTTPS origin. Production startup requires Tiger PostgreSQL, Temporal and owner authentication.

Hosted settings: `AI_PROVIDER=openrouter`; primary `google/gemma-4-26b-a4b-it:free`, fallback `google/gemma-4-31b-it:free`. Only free Gemma IDs are accepted. Shared quotas remain shared; API key rotation cannot increase them. Queue failed analysis and keep manual actions available.

Budget target: about $20 Render credits for 14 days at the initial allocations, with a $40 ceiling allowing memory upgrades; estimate excludes excess traffic/build usage. Tiger target $25 at a suitable small instance. Verify credit expiry and actual rates before deployment. No services have been provisioned by this repository.

## Sending and reminders

Owner approval is required for immediate replies and exact scheduled recipient/text/time. New chat activity pauses approved schedules synchronously. Changed task revisions or deadlines pause them too. Anything over fifteen minutes late requires new approval. Unknown delivery outcomes are never blindly retried; interrupted sends become uncertain on restart. Owner reminders are internal; no push service is required.

The current UI can cancel schedules and create new approvals. Automatic historical reconciliation and an explicit reapprove/edit workflow are outstanding; uncertain sends require inspection in WhatsApp. Sender IDs prevent repeated immediate-send requests from being dispatched twice.

## Target tracks

The active targets are Gemma, Mastra, Tiger Data, Temporal and Render. Gemma and Mastra power extraction and drafting; Tiger stores confirmed state and retrieves agreements; Temporal owns durable processing and timers; Render hosts the app. Sentry was removed from the project plan at the owner's request. Follow `template.md` for the final submission and report actual pilot feedback rather than invented results.

## Attribution

Kairo Platform, supplied by the user, informed the inbox/composer/evidence layout, WAHA event normalization and delivery patterns. This implementation is a separate TypeScript project, not a copy of its telecom/churn system. Preserve notices if further source code is borrowed. WAHA, Ollama, Mastra, Temporal and the embedding model retain their respective licenses.

## Current local WhatsApp test

Create an account on the sign-in page, then configure your own number and allowed clients through the UI. The private `.env` holds infrastructure credentials; legacy owner-password and number variables are no longer used. The existing Tiger service is reused with the isolated `followthrough_whatsapp_test` schema; no additional cloud service is needed.

```sh
docker compose --profile whatsapp up -d waha temporal
npm run build
npm start
npm run check:integrations
```

Open http://localhost:3001, sign in, and use Settings → Start connection → Show pairing QR. On the business-owner phone open WhatsApp → Linked devices → Link a device and scan the QR. The client phone stays on its own WhatsApp account. Test new text messages between the two numbers; no historical backfill is implemented.

Send a client request, then reply on the owner phone with an explicit promise such as “I will send the draft tomorrow.” Verify both messages, the responsible party, deadline and original-message source in the dashboard. Check a draft before using Send. Scheduled follow-ups require a separate exact-text/time approval. Review them in Tasks → Scheduled, including client/channel, send time, message, status and pause reason. Channel and status filters apply there; immediate chat sends are excluded. Run `npm run check:integrations` to check Gemma, Tiger persistence/hybrid retrieval, Temporal connectivity, and WAHA; a reachable connector does not prove that WhatsApp is paired or that an actual message was delivered.

The local ARM WAHA image can be configured through `WAHA_IMAGE`; the private test config pins the already-installed official ARM image by digest. The Render scaffold uses the browserless amd64 NOWEB variant. No MongoDB Atlas prize-track claim is planned after the switch to Tiger-only storage.

### VS Code Run and Debug

Open this project folder in VS Code, select **FollowThrough: Start all services** in Run and Debug, then press **F5**. The pre-launch task starts Docker Desktop on macOS if necessary, starts/reuses the WAHA and Temporal Compose services, starts/reuses Ollama, and checks the configured model is installed. It then builds the dashboard and debugs `src/server.ts` using the project-local Node 22 runtime. The API serves the dashboard and starts its Temporal worker; the browser opens at http://localhost:3001 when the API is listening. Existing `.env` credentials and the hosted Tiger database are reused.

Install dependencies with `npm install` before the first run. Stop any app already listening on the configured API port before F5. Press **Shift+F5** to stop the API and its worker. Docker services and Ollama remain running to preserve the linked WhatsApp session and support quick restarts. Frontend changes require restarting this launch configuration to rebuild the dashboard; backend breakpoints work in the TypeScript source. No separate `npm run worker` or `npm run ui` is needed for this configuration.


## Accounts and client numbers

The sign-in page supports registration with name, email and a password/passphrase of 15–128 characters. Salted scrypt hashes use N=131072, r=8, p=1; hashing is serialized to bound memory consumption. Sessions use random 256-bit opaque tokens, stored only as SHA-256 hashes on the server. Cookies are HttpOnly and SameSite=Strict, plus Secure in production. Sessions expire after seven days or 24 hours of inactivity. Login/registration/password-change attempts are rate limited in persistent storage. Origin checks and a required dashboard header protect write endpoints. Changing a password requires the current password and revokes existing sessions; logout revokes the current session.

Settings saves the user's WhatsApp number. Allowed clients adds/removes named international numbers. Removal preserves historical records, disables new ingestion/sending and pauses approved follow-ups. Pairing and every live send/ingest verify the linked phone against the saved owner number. New accounts have empty workspaces; existing legacy test data and the default WAHA session are preserved separately and are not automatically claimed by the first registrant. Users must pair their new account-specific session.

API handlers, local batches, V2 Temporal workflows/activities and retrieval queries carry an explicit account ID; requests cannot choose a different workspace ID. Existing legacy Temporal histories stay on the old queue, while account workflows use `followthrough-v2`. File mode supports one app process for local testing; use Tiger for shared API/worker persistence. The account repository uses a CAS JSONB document for this pilot; normalized indexed account/session tables are needed for larger deployments. Email verification, forgotten-password recovery and MFA are not implemented; do not present them as available. Email is currently a login identifier, not proof of mailbox ownership.

## Telegram and the shared task timeline

FollowThrough now supports personal Telegram accounts alongside WhatsApp. The Telegram adapter uses the open-source GramJS MTProto client, not the Bot API. Add application credentials from https://my.telegram.org/apps to `.env` as `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`, then restart the app. F5 starts the adapter inside the API; no extra Telegram container is needed.

1. Register/sign in. Save your owner number in Settings.
2. In Settings → Telegram, save the Telegram account's international number (it may differ from WhatsApp), click Connect Telegram, then scan the QR in Telegram → Settings → Devices → Link Desktop Device. If Telegram requests two-step verification, enter its password in the dashboard; it is used in memory and not stored.
3. In Allowed clients → Add client, choose Telegram and select a private conversation from the connected inbox. The picker lists up to 100 recent private human chats. Telegram peer IDs are authoritative; phone numbers may be hidden, so numbers are not guessed or used to silently merge identities.
4. Conversations has All channels / WhatsApp / Telegram filters and channel icons/badges. Both owner-phone and client messages feed the same extraction workflow. Replies and templates send through the selected conversation's original provider.
5. Tasks and the four-day calendar combine both channels by default; their channel filters and source badges identify provenance. Completed tasks leave active views but stay in history. Different-platform identities remain separate conversations until an explicit identity-linking feature is built.

Telegram currently supports new text messages and text captions in private chats; groups, channels, bots, media analysis, edits, deletions and secret chats are outside this integration. Existing history is not imported when a conversation is first allowed. On app restart, allowed chats with previously captured messages fetch up to 100 newer messages; this is bounded recovery, not an unlimited historical sync or exactly-once guarantee. GramJS handles ordinary transport reconnection; a complete prolonged-offline recovery test is still required. Uncertain sends are never retried automatically.

Telegram StringSession credentials live separately in `ft_channel_sessions` (or private local connection files), encrypted with AES-256-GCM and bound to the workspace ID as authenticated data. They are never included in `/api/state`. In production, provide a stable 64-hex-character `SESSION_ENCRYPTION_KEY`; back it up securely. Development generates a mode-0600 key under `data/connections/`; retain that key across restarts. Disconnect revokes the Telegram session, removes its saved credential and pauses approved Telegram follow-ups. Changing the Telegram number requires disconnecting first.

Run one API instance with its embedded worker for Telegram. A standalone worker is deliberately prevented from opening a duplicate Telegram send session. Shared multi-instance adapter ownership is future work. iPhone SMS is not implemented.

### Workflow verification

`npm test` covers provider isolation, authenticated encryption, account access controls, scheduling and task rules. `npm run test:workflow` additionally requires Ollama, Tiger and Temporal: it creates an isolated temporary workspace, feeds synthetic WhatsApp and Telegram events through real Gemma/Temporal/Tiger, restarts its test worker, verifies tasks/calendar/drafts/reminders/completion, then terminates its test workflows and removes only its test records. It never sends real messages. Stop the API before this recovery check so its embedded worker does not consume the test workflow during the planned restart. Optional `TEST_OWNER_PHONE_E164` and `TEST_CLIENT_PHONE_E164` select test identities; legacy local test-number variables are accepted by this script only.

`npm run test:calendar` checks realistic conversational acceptance, changed dates and times, explanations, multiple deliverables, completion, cancellation, client inputs, refusals, conditional language, midnight boundaries and duplicate messages. It runs local Gemma through the task service and Tiger in a disposable workspace, checks the same calendar function used by the dashboard, and writes examples and observed results to `CALENDAR-SCENARIOS.md`. The API may stay running; this check does not send provider messages or test Temporal recovery. `npm run test:commitments` provides three smaller extraction-only checks.

Live end-to-end Telegram validation requires your application credentials, a registered account, QR confirmation and a real message from an allowed client. Automated adapter/pipeline checks do not replace that live test.
