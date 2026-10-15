# Final product recheck — 15 October 2026

This report separates direct observations from checks not performed. The audit did not send real messages, modify account data, provision services or change production configuration.

| Check | Result | Evidence |
|---|---|---|
| Public HTTPS root | PASS | `https://scheduleup.tech/` returned 200 HTML with certificate verification |
| Frontend assets | PASS | Deployed JS `index-B9ksf2q8.js` and CSS `index-CdGhmzaX.css` returned 200 |
| API liveness | PASS | `/api/health` returned 200 with `{"ok":true}` |
| Signed-out session | PASS | `/api/auth/me` returned 200 with `user:null` |
| Protected state | PASS | `/api/state` returned 401 without a session |
| Response protections | PASS | CSP, HSTS, frame denial and MIME protection headers present |
| Render inventory | PASS | Exactly three services, one instance each; all unsuspended with live deployments |
| App revision | PASS | Live revision matched repository `9b14beb3004301f296f2222e1902fbc11eeb7568` before documentation edits |
| Recent app logs | PASS, sampled | Latest 100 entries included 50 completed HTTP 200 responses, no error-level entries and one app hostname |
| Tiger database | PASS, read-only | Production connection with trusted TLS returned `SELECT 1`; application tables present |
| Primary Gemma endpoint | PASS | 26B model returned `READY` in 2.636 seconds |
| Application extraction | PASS | Actual Mastra/extraction/guard code returned an owner task for “send the revised proposal tomorrow”, dated 2026-10-16; 7.265 seconds; synthetic input was not persisted |
| Fallback Gemma endpoint | DEGRADED | 31B model returned HTTP 504 initially, then HTTP 502 on both retries |
| Automated regressions | PASS | 93/93 tests; permitted rerun allowed the account-test HTTP server to bind |
| Production build/typecheck | PASS | Vite build and `tsc --noEmit` completed |
| Local duplicates | None found for this product | No local API or inference listener; Docker daemon socket absent; the port-5173 Vite process belongs to another repository |

## Active issue

The configured `google/gemma-4-31b-it:free` fallback is unreliable in this sample. The primary `google/gemma-4-26b-a4b-it:free` endpoint and structured extraction passed. This does not establish future availability, quota headroom or general extraction accuracy. No fallback replacement or production configuration change was made during the audit.

## Private-service and workflow limits

Render reports WAHA and Temporal live. Their recent log samples contained no error-level entries; Temporal had no entries within the sampled last-hour window. Historical startup logs include polling warnings and a persistent-store error at 04:10 UTC on 15 October; they do not establish a current failure or prove recovery. App worker state-change logs are present.

Private WAHA pairing/status, Telegram live state, Temporal namespace/task-queue health, hosted restart recovery and real message delivery were not directly verified in this audit. Existing SSH access could not be used because a trusted Render host key was not available locally. Service liveness and past owner reports are not substitutes for these checks.

The extraction probe used the deployed inference credentials and repository AI code, outside the hosted HTTP workflow. It validates generation and deterministic guards, not the complete channel → Temporal → storage → calendar lifecycle. The database probe checked connectivity rather than persistence writes or hybrid-search quality.

Use the [acceptance scenarios](CALENDAR-SCENARIOS.md) to record those remaining outcomes with an authenticated account and owner-approved messages. Documentation and diagram changes after this report have been checked locally; they have not been deployed by this task.
