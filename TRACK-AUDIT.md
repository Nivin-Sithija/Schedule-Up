# FollowThrough track audit — 15 October 2026

The local product has meaningful open-AI functionality. Submission readiness varies by track; a dependency or blueprint alone is not evidence of a completed integration. Assessments below are engineering judgments, not predictions of awards.

## Verification performed

- Fresh `npm run check:integrations`: Gemma/Ollama response, Tiger workspace read/write with revision advancement, Tiger embedding/pgvector/full-text hybrid retrieval, Temporal namespace connectivity and WAHA connector session WORKING all passed. Temporary probe records were removed. The connector script checks its configured legacy session; account-specific WhatsApp and Telegram live testing is recorded separately in VALIDATION.md.
- Fresh Temporal inventory: three running V2 workflows. This establishes real workflow executions, not a new restart/retry test. The earlier disposable integration test recorded worker-restart recovery; it did not establish production cluster availability or full transport-offline recovery.
- Latest build/typecheck passed. Prior recorded results: 73 automated tests, 15/15 calendar scenarios through real local Gemma and Tiger. These examples are not a statistical accuracy estimate.
- Secret-presence checks only: Tiger and Telegram application credentials are configured; SENTRY_DSN and OPENROUTER_API_KEY are absent. Production SESSION_ENCRYPTION_KEY is absent; local Telegram uses its existing private key file. No credentials were printed.
- OpenRouter's public model catalog returned both configured free Gemma IDs with zero listed prompt/completion prices. This is not an authenticated inference test or an availability/quota guarantee.

## Track assessment

| Track | Actual contribution | Current readiness | Next useful evidence/change |
|---|---|---|---|
| Gemma | Interprets requests, conversational acceptance, deadline changes, responsibility and completion; generates reviewed drafts | Strong local use, hosted inference unverified | Run the same fixed evaluation through hosted Gemma; compare errors, token counts and warm latency. Preserve refusal/ambiguity and source-evidence guards. |
| Tiger Data | Authoritative account/task/message state plus per-account, per-client pgvector and keyword search | Working and materially useful | Demonstrate an older agreement retrieved beyond the recent context window, with source attribution; compare with retrieval disabled. Report storage/search cost and latency. |
| Temporal | Per-client durable message signals, retried analysis activities, persistent send timers and recurring reminders | Working locally, useful recovery architecture | Record a controlled worker failure/restart and one transient inference failure, with workflow history and one committed task. Keep ambiguous provider sends out of automatic retry. |
| Mastra | Real Agent.generate calls over Gemma for extraction, repair and drafts | Working, but currently thin framework use | Use a Mastra workflow for bounded context/retrieval → extraction → validation/repair → validated result. Temporal remains responsible for durability; application code remains responsible for commit/send authority. A read-only agreement retrieval tool can be useful when context is missing. Do not add unbounded agent loops or autonomous send tools merely for a track. |
| Sentry Agent Tracing | Manual spans around model calls, retrieval, task commits and scheduled dispatch; usage attributes when supplied | Instrumentation exists, export disabled and evidence missing | Configure DSN; verify connected batch traces, separate model/repair spans, tokens, latency, outcome and quota errors. Align agent operation/name attributes with Sentry conventions, correlate durable runs and capture redacted before/after debugging evidence. Do not claim actual costs from the current free/local billing marker. |
| Render | Docker API/frontend/embedded worker plus private WAHA and Temporal blueprint | Scaffold only; no deployment verified | Finish production secrets, TLS CA, session-key migration, private webhook URL, disk permissions and embedding-cache preparation. Deploy, measure RAM/boot behavior, verify domain/HTTPS/reconnect/restart and calculate actual 14-day costs. |
| .tech domain | Intended public identity for the app | Not connected/verified | Connect the claimed domain to the deployed app and include the live URL. |
| Backboard | No runtime integration or documented R-CLI/model comparison use | No supported claim | Skip unless a genuine, recorded contribution is made. Avoid duplicating Tiger's storage merely to add a category. |
| MongoDB Atlas | Explicitly removed in favor of Tiger | Not applicable | Do not claim this track or add a second database solely for eligibility. |

## Material deployment gaps

1. OpenRouter has no configured key. The hosted extraction path, schema-response compatibility, fallback and quota failure behavior have not been tested with the selected endpoints.
2. Sentry is disabled. No Sentry UI evidence, validated agent classification, complete cost reporting or cross-workflow trace continuity exists yet. `gen_ai.operation.name` currently holds application call kinds such as `extract`; these should be reviewed against the selected Sentry agent conventions before claiming agent-monitoring coverage.
3. Render's blueprint is marked scaffold. Its standard API allocation and two starter private services have not been measured under the embedding model and embedded worker workload. The older README cost target is a planning estimate, not a current Render quote. Free model token pricing does not cover infrastructure or ensure two weeks of service availability.
4. Existing Telegram ciphertext must retain access to the same encryption key during migration; simply generating an unrelated production key would require re-linking or an explicit re-encryption migration. Treat the key as a secret.
5. Local Tiger TLS uses a private CA file excluded from the Docker context. Provide trusted CA material as a deployment secret and configure TIGER_CA_PATH; preserve hostname/certificate verification.
6. The Dockerfile does not prewarm the local embedding-model cache. Cold downloads on deployment need to be eliminated or tested against startup health deadlines.
7. Temporal currently uses the SQLite development server with a disk, suitable for this controlled pilot demonstration. This is not a production high-availability Temporal cluster. Persistent disk ownership and recovery on Render remain untested.
8. The Scheduled tab excludes immediate chat sends. Its visible stored statuses help demonstrate why a follow-up paused; an approved status alone does not prove provider delivery.

## Recommended order

1. Strengthen Mastra's useful bounded workflow and Sentry trace structure together, keeping the existing safety and calendar regressions.
2. Export a redacted trace for acceptance, counteroffer/agreement, repair and paused follow-up. Use the actual timezone and multi-deliverable bugs from CALENDAR-SCENARIOS.md as debugging examples, and label any replay as a replay.
3. Test hosted Gemma on the same fixtures; record provider errors and rate-limit recovery. Never label local results as hosted measurements.
4. Complete one recorded Temporal retry/restart demonstration. Do not restart active user follow-ups casually during evidence collection.
5. Deploy to Render with production credentials and the domain, then run the real two-channel lifecycle on the deployed URL and monitor the two-week budget.
6. Have a real side-hustle owner use it on actual work. Record their friction, time saved and willingness to pay without inventing payment or business outcomes. Prepare a concise demo and write-up around missed commitments rather than a list of integrations.

## Challenge/source verification

[Official Week 2 requirements](https://dev.to/challenges/hacktoberfest-week2-2026-10-12) list the relevant tracks; local or provider-hosted Gemma is allowed and Render frontend hosting is an accepted use. The published criteria prioritize writing quality and meaningful use. Multiple genuine category entries are allowed, but only one win per submission. The [launch announcement](https://dev.to/devteam/join-the-hacktoberfest-open-source-ai-challenge-side-hustle-2550-in-prizes-across-18-winners-55ba) gives the deadline as 18 October, 11:59 PM PDT (19 October, 12:29 PM Asia/Colombo).

Primary references: [Mastra agents](https://mastra.ai/docs/agents/overview), [Sentry AI observability](https://sentry.io/solutions/ai-observability/), [OpenRouter hosted Gemma](https://openrouter.ai/google/gemma-4-26b-a4b-it:free), [Render deployment documentation](https://render.com/docs/deploys).
