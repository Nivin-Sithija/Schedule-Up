# Local validation — 13 October 2026

## Verified

- Production frontend build and TypeScript checks pass.
- 31 automated tests cover speaker identity, client isolation, evidence, context fitting, calendar resolution, responsibility rules and scheduled-send eligibility.
- Temporal's workflow bundler compiled the conversation, reminder and send workflows successfully.
- Local API health endpoint returned 200.
- Dashboard and Clients layout inspected in Chrome.
- End-to-end simulator: owner message “I will send the draft on Friday.” produced an Open owner task dated **2026-10-16**, linked to its source message.

## Live Ollama smoke evaluation

Provider: local Ollama. Model: `gemma4:12b`. Timezone: Asia/Colombo. Four synthetic scenarios; each test uses a message timestamp of 13 October 2026.

| Scenario | Expected | Observed | Warm latency |
|---|---|---|---|
| Owner promises a proposal Friday | Open owner task; 16 October | Pass | 3.140 s |
| Client tentatively suggests next week | Owner review | Pass | 4.089 s |
| Owner requests the logo | Waiting on client | Pass | 2.817 s |
| Client says thank you | No new task | Pass | 0.401 s |

These measure the complete extraction function, including deterministic guards. They do not establish raw model accuracy or the planned 40-case evaluation. An earlier cold request took about 90 seconds. Warm-cache effects and changed prompts/settings mean the comparison is not a controlled benchmark.

Earlier evaluation exposed incorrect JSON structure, weekday arithmetic and request responsibility. Schema-constrained output, deterministic message-local calendars and narrow responsibility guards corrected these smoke scenarios. Ambiguous or truncated context continues to require owner review.

## Not yet verified

- Temporal server restart recovery: Docker CLI is installed, but its daemon was not running during validation. Workflow bundling passed; no live Temporal server test was completed.
- Real WAHA pairing, linked-ID mapping, provider delivery and reconnection.
- Atlas and Tiger integrations against configured databases.
- OpenRouter hosted calls, quota behavior and 14-day deployment.
- Live Sentry export and cross-service trace propagation.
- Backboard/R-CLI development evidence and a real-user trial.

No real WhatsApp messages were sent. No Render services were provisioned and no Render/Tiger credits were consumed by deployment.

## UI refresh — 14 October 2026

- Rebuilt the navigation, overview, task cards, templates, and conversation layout using white/black with beige and pale blue accents. Custom SVG icons are rendered in code; no generated images or fabricated charts are used.
- Conversation layout includes client search, active-task filtering, source-message highlights, reply drafts/templates, a composer, and a separate commitment panel.
- Browser prompts were replaced with modal forms for task creation, deadlines, templates, and exact-message follow-up approval. Forms keep server-side revision/approval checks intact.
- Added a client identity check before inserting a pending AI draft, and preserved newly edited composer text when a previous send finishes.
- `npm run build` passed (Vite production build and TypeScript).
- `npm test` passed all 31 existing tests. These verify model-context and workflow rules; they are not browser interaction tests.
- Visually inspected the overview in Chrome and the conversation layout and deadline modal in Safari. Confirmed the revised professional Dashboard labels in Safari. Mobile breakpoint styles are implemented but have not been visually verified.
- No live WhatsApp messages were sent, and no deployment was performed.

- Removed promotional headings, slogans, and decorative captions at the user’s request. Screens now use factual Dashboard, Tasks, Conversations, Needs review, and Reply templates headings. Replaced the motivational card with workspace counts.

## Tiger-only local integration setup — 14 October 2026

The user changed the database plan to Tiger-only. MongoDB dependencies and deployment/configuration entries were removed; Tiger now holds the authoritative workspace in `ft_workspace` and the hybrid-search index in `ft_chunks`. The private local config uses the existing Tiger service and isolated `followthrough_whatsapp_test` schema. Certificate-chain and hostname verification remain enabled through a local certificate bundle. No additional Tiger cloud service was provisioned.

Live integration checks passed for local Gemma inference, Tiger workspace reads/revision writes, local embeddings with pgvector/full-text retrieval, Temporal namespace connectivity, and WAHA authenticated API access. The Temporal worker reached RUNNING. Corrected local Temporal volume ownership after the first startup failed. QR JSON handling and session creation were fixed, and paired-owner identity is checked before message processing or sends. Build and all 31 existing tests passed after the changes.

The user corrected the owner/client roles. Updated the private configuration and the empty test workspace (zero messages, tasks and schedules), restarted the app, and verified the corrected client in the running API. The QR endpoint returned an image. Phone numbers and credentials remain in the ignored private `.env`, not this document.

WhatsApp was still awaiting QR scanning at the last check. No actual WhatsApp messages were sent. Real two-way message ingestion, extraction through the live Temporal pipeline, delivery, and restart recovery still need a paired-phone trial; the component checks do not prove those outcomes. Atlas and the MongoDB Atlas prize track are no longer part of the chosen architecture.

## QR pairing expiry fix — 14 October 2026

WAHA reported `FAILED` with `QR refs attempts ended` after the unscanned pairing session expired. The old QR endpoint requested an image without recovering that session, producing HTTP 422. Added session-state-aware recovery: restart FAILED, start STOPPED/missing sessions, wait for SCAN_QR_CODE, and verify the configured owner when already WORKING. Concurrent QR requests share one recovery operation. The Settings panel refreshes the QR every 20 seconds while open, clears stale images on failure, and displays pairing errors locally. Connected accounts are never restarted just to obtain another QR.

Production build passed and all 35 tests passed, including expired-session recovery, connected-owner protection and concurrent QR retries.

## Notifications and live-message routing — 14 October 2026

Added dismissible, accessible success/error/info toasts above modal dialogs, with automatic dismissal and duplicate suppression. Actions report completion, failures report errors, new internal reminders appear as popups, and verified WhatsApp state is checked every five seconds. Connection verification confirmed WORKING with the configured owner and the reminder workflow RUNNING.

Live WAHA logs showed message.any webhooks returning 200 but the workspace still contained zero messages. A linked-ID lookup returned 400 because NOWEB contact storage was disabled. Installed WAHA source also showed owner-phone NOWEB events can contain the peer in `from` with `to` absent. Added parsing of that shape and matching signed provider `remoteJidAlt` metadata to the allowlist, with peer/actor consistency checks and group exclusions. No session logout, re-pairing, store-setting change or historical import was performed.

Production build and 39 tests pass, including both directions of NOWEB messages, linked-ID alternate metadata, mismatched peer rejection and unknown/group exclusions. Actual post-fix phone-message capture remains to be checked by sending a fresh message; earlier ignored messages were not retained for replay.

## Successful NOWEB sends misreported as uncertain — 14 October 2026

The live connector logged successful HTTP 201 sends in about 10–1127 ms, so the reported uncertainty was not caused by the 20-second request timeout. Installed WAHA NOWEB code returns the raw Baileys message with `key.id`; the app previously expected a top-level `id`. Later owner-message echoes had already confirmed the three affected outbox records, but their old error strings remained.

Added normalization for raw NOWEB keys, serialized ID objects and string IDs. Raw keys now produce the same identifier used by WAHA message.any and ACK events. Confirmation clears old errors, a late exception cannot overwrite a confirmed send with uncertainty, and ambiguous text-only echo matches do not confirm multiple requests. The UI blocks identical replies while unconfirmed and reports late confirmation as success. Cleared only stale errors on already-confirmed sends; no sends were repeated.

Build and 43 tests passed, including raw response normalization and confirmation/timeout races. No extra live WhatsApp message was sent to validate this fix; the next owner-approved dashboard send will exercise the updated live path.

## Completed tasks and fresh context — 14 October 2026

The dashboard and conversation context panel show only open/review/waiting tasks. Completed and cancelled records remain in Tasks history. Completed-task counts/cards and their reminders are removed from the front-page UI.

The model's recent-history window starts after the latest completed/cancelled task update for that client. Evidence for other active tasks and fresh webhook batches is preserved. Hybrid retrieval obeys the same boundary, so it cannot silently reintroduce old closed-task evidence as recent context. Conversation messages and task history remain stored. Proposal-based completion also updates the closure timestamp.

Build and 45 tests passed, including closure boundaries, history preservation, parallel active-task evidence and new batches. No real tasks were modified for validation.

## Four-day calendar and chat completion — 14 October 2026

Tasks now includes a calendar above the list covering today plus three days in the configured workspace timezone. Active task deadlines populate the date columns; timed deadlines convert to the workspace-local day and date-only deadlines stay date-only. Day selection filters the task list, All dates clears the selection, and calendar entries open supporting chat evidence. Undated and later tasks remain available in the unfiltered list.

Explicit chat completion can now close manually edited tasks as well as extracted tasks, preserving edited title/responsibility/deadline fields. Completion requires fresh evidence and a matching task. Future promises, negation, questions, generic thanks and ambiguous multi-task completions require review. Closing a task updates its revision/time and pauses approved follow-ups. Build and all 51 tests passed, including local date grouping and completion evidence rules.

## Categorized templates — 14 October 2026

Templates retains existing replies and adds Business card, Services, Opening hours and Contact details categories. Missing categories on previously saved templates fall back to replies. Category tabs filter saved items; creation and editing persist the category through validated POST/PATCH endpoints. Blank business-information starters contain no invented business details. All categories appear in the conversation template picker and insert text into the composer for review. Business cards are text templates, not media or vCard attachments. Changing a category preserves custom draft text.

Build and all 51 existing tests passed. Category validation checked legacy defaults, all five categories and invalid-category rejection. The restarted local server passed authentication, saved-template retrieval and invalid-category rejection checks without changing user records or sending messages. New category creation/editing has not been exercised against the live database in this validation.

## VS Code service startup — 14 October 2026

Added a Run and Debug configuration, sequential pre-launch tasks and a local dependency startup script. Startup was exercised with Docker Desktop initially stopped: it opened Docker Desktop, started existing WAHA and Temporal containers with their named volumes, verified authenticated connector readiness, verified Temporal connectivity and reused Ollama with the configured Gemma model. A separate startup smoke check confirmed API health and the embedded Temporal worker reached RUNNING, then requested graceful termination. JSON parsing and the full build/typecheck passed. VS Code's debugger/browser-opening behavior has not been exercised inside the editor.

## Individual accounts and Allowed clients — 15 October 2026

Replaced the shared owner-password flow with per-user registration, login, password change and revocable opaque sessions. Passwords use salted asynchronous scrypt (N=131072,r=8,p=1); only session-token hashes are stored. Cookie flags, absolute/idle expiry, persistent rate limits and write-origin/header checks are enforced. Workspace context is required and restored for HTTP handlers, local batches and V2 Temporal activities. Account-specific WAHA sessions and workspace-filtered hybrid retrieval replace the singleton paths for new accounts. Legacy workspace, search table, session and workflow histories remain separate and unclaimed.

Added Settings owner-number setup and a separate Allowed clients page with add/remove, duplicate/self-number validation and client numbers displayed on dashboard/conversation views. Removal preserves history, disables ingestion/sending and pauses approved follow-ups. Re-adding a number reuses its historical client ID.

Build/typecheck and all 54 tests passed. New integration tests exercised two accounts, cross-account task/client denial, weak-password rejection, cookies, restart persistence, forged sessions, untrusted origins, password rotation, logout, registration limits, add/remove/re-add and duplicate numbers. Live Tiger probes verified workspace and retrieval isolation even with identical message/client IDs, then cleaned their temporary records. The real API started with Tiger and the V2 Temporal worker reached RUNNING; unauthenticated state access returned 401. Two stopped, unpaired WAHA sessions were created/listed/deleted successfully without touching default or sending messages. This uncovered and fixed stopped-session listing (`all=true`) and empty successful connector responses. Safari visually checked registration and the separate Allowed clients page in read-only demo mode; no real account was created or phone re-paired for this validation.

Email verification, forgotten-password recovery, MFA, and a complete newly paired multi-account WhatsApp message journey remain unimplemented/unverified as applicable. The pilot account repository is CAS JSONB; normalized indexed account/session tables are needed at larger scale.

## Telegram channel and mixed task timeline — 15 October 2026

Added an embedded personal-account Telegram adapter using GramJS MTProto, QR login, optional in-memory two-step verification and encrypted workspace-bound StringSession persistence. Private human conversations are explicitly allowed from the connected inbox. Provider-scoped normalization captures owner/client text and prevents same-ID collisions with WhatsApp. Stored client channel selects the outgoing transport; task provenance comes from that stored channel. WhatsApp setup changes preserve Telegram allowlists and the independent Telegram owner number.

Conversations and Tasks have All channels / WhatsApp / Telegram filters. Channel icons/badges appear on conversation headers/list entries, task cards, dashboard client/task rows and calendar entries. Both channels share the existing calendar and task lifecycle; identities remain separate conversations. The read-only demo now includes both providers. README, architecture, task scope, submission notes, environment example, Render scaffold and local startup guidance were updated.

Final build/typecheck and all 58 tests passed. Added tests cover Telegram actor/provider normalization, unknown/removed/nonprivate traffic rejection, authenticated encryption/tampering/wrong-account rejection and preserving mixed-channel settings. Safari verified Telegram-only conversation filtering, its message, task badge and the mixed-channel demo.

`npm run test:workflow` passed with real local Gemma, Temporal and Tiger. It used a disposable workspace and synthetic provider events with the configured test identities, queued durable signals, restarted a worker, verified dated tasks from both channels in the same four-day calendar, paused an approved Telegram follow-up, generated an editable draft, persisted reminders, recognised explicit Telegram completion, preserved the other channel's active work and checked fresh completed-task context. Workflows and temporary workspace/search records were cleaned up. No real message was sent by that check.

Live provider validation is still pending: TELEGRAM_API_ID/TELEGRAM_API_HASH are not configured, and the account repository currently has no registered user. The existing legacy WhatsApp default session remains separate. The owner must register, save their numbers, link account-specific WhatsApp/Telegram sessions and allow the client before real message tests. Actual Telegram QR/2FA, receive/send, reconnect and provider delivery have not been proven against a live Telegram account. SMS remains unimplemented. Telegram requires the embedded API worker; multi-instance connection ownership and full historical sync remain future work.

## Registration form recovery — 15 October 2026

The reported browser state showed “Failed to fetch” with no matching registration request in the server log; the API was reachable when checked. Hardened the form to read named submitted fields (including browser autofill), show explicit name/email/password/confirmation validation beside the submit button, translate network failures into an actionable message and stop background workspace polling while signed out. This avoids background requests obscuring registration feedback. The exact cause of the earlier transient fetch failure was not established.

A disposable account successfully registered against the running Tiger-backed API, received a session cookie and opened its authenticated workspace; only its account/session/workspace/test workflow were then removed. The real user subsequently confirmed registration worked, and Chrome showed their signed-in Settings screen. Build/typecheck passed; added form tests cover autofilled submitted values and short/mismatched password feedback.

## Conversational commitments — 15 October 2026

Live test messages were present in both account-specific WhatsApp and Telegram conversations, including dashboard owner replies. The WhatsApp acceptance was analyzed as another copy of the original client request; duplicate review cards accumulated. Telegram's counteroffer repeatedly failed with an unknown-task reference because pending requests were not existing tasks. These were application extraction/context issues, not evidence that Gemma was disconnected.

Added explicit conversational-acceptance and counteroffer instructions, compact request-local ID aliases restored before evidence validation, pending-request context, guarded conversion of updates to uncreated requests, validation-aware repair, fresh-evidence enforcement and review-card reconciliation. Deadline resolution retains "by 10 AM" in Asia/Colombo and recognizes the proposed 17th before an unrelated reason mentioning tomorrow. No sending permission is granted by task extraction.

Build/typecheck and all 68 automated tests pass. `npm run test:commitments` passed three real local Gemma scenarios: typo-filled owner acceptance automatically opens the task; a proposed 17th remains review; subsequent client agreement opens the task on the 17th. These synthetic regression checks do not send messages or write workspace state.

Reprocessed the two existing live test replies through `processBatch` with the API stopped, then restarted the API/embedded worker. Tiger now contains one open WhatsApp task due 16 October at 10:00 Asia/Colombo, no WhatsApp review cards, and one Telegram review request dated 17 October awaiting client agreement. Both clients' analysis is ready. No message was sent during repair. The restarted API serves the page/assets and authenticated connection/state routes successfully. Complete live follow-up, completion and offline provider-recovery testing remains outstanding.

Chrome subsequently displayed the corrected live Dashboard: Your tasks 1, Needs review 1, and the WhatsApp task "Send revised proposal" due 16 Oct, 10:00. The DevTools console showed no messages during this inspection.

## Broader calendar conversation scenarios — 15 October 2026

`npm run test:calendar` now runs 15 realistic scenarios through local Gemma/Mastra extraction, the production task service, Tiger persistence and the dashboard's four-day calendar function. The fixtures alternate WhatsApp/Telegram provenance and use an isolated disposable workspace. Existing-task scenarios seed previously accepted tasks. Synthetic messages never reach a provider, and the test does not exercise Temporal recovery or the live UI.

The first run exposed wrong timezone offsets for 24-hour and explicit-date times, replacement dates being overwritten by an old deadline in the explanation, two deliverables sharing a date, another task's "pending" sentence preventing completion, and explicit client promises being routed to review. Fixed task-specific clause selection, deterministic named-month/ordinal/relative date and AM/PM/24-hour resolution, clause-specific completion checks, counteroffer guards for existing-task updates, and explicit-client-promise instructions. The conditional-language expectation permits either ignoring an uncommitted idea or offering review, while requiring no accepted task/calendar entry.

Final result: **15/15 scenarios passed**. Coverage includes informal acceptance; promises with explanations; undated commitments; moving an existing deadline; proposed and agreed changes; two tasks with distinct dates; completing one task while another is pending; cancellation; waiting on client inputs; refusal; conditional wording; short corrections; midnight timezone boundaries; and processing the same event twice. Full build/typecheck and **73 automated tests passed**. Example messages, expected outcomes, observed task/calendar state and individual latency are recorded in `CALENDAR-SCENARIOS.md`. Both temporary test workspaces and their retrieval rows were removed. These are regression examples, not a measured general model-accuracy guarantee.

## Hosting preparation — 15 October 2026

Created and pushed the private GitHub repository. Added inline trusted Tiger CA support with certificate validation and rejectUnauthorized=true, private secret-file preparation preserving the existing Telegram encryption key, CPU-only ONNX installation, and embedding prewarm during image build. No secrets or local account/session data were committed. Build/typecheck and all 80 tests pass.

OpenRouter's configured key authenticated successfully and reported the free tier with 50 daily requests remaining. Its later spending cap was $1 with $1 remaining. Tiny requests to both configured free Gemma endpoints failed with HTTP 429, limit_source=upstream_provider_shared_pool. This is distinct from a key spending cap or exhausted daily quota; hosted extraction is NOT verified and no paid endpoint was selected. Added status-aware provider-error classification so a generic upstream error can still display the actual rate-limit category.

The AMD64 Temporal image built. A fresh Docker volume was initially unwritable by the temporal user. Added startup ownership initialization followed by privilege drop; an isolated container started its server, and its non-root user had a nonempty writable SQLite database. The test container and volume were removed. Main-image local AMD64 builds stalled during dependency installation under emulation; a manual native AMD64 GitHub container check was added. Its result must be recorded separately. No paid Render resources have been created.
