# Implementation architecture

[System diagram](SYSTEM-OVERVIEW.md) · [Use cases](USE-CASES.md)

## Intake and workflows

WAHA supplies signed account-session webhooks; GramJS supplies personal Telegram updates inside the API. The application verifies the linked owner and allowed client before ingestion. Unknown clients, groups and unsupported event types do not become conversations. Provider message IDs are namespaced and checked for duplicates.

New activity synchronously pauses approved follow-ups before analysis. `signalWithStart` records messages in account/client-scoped Temporal conversation workflows on `followthrough-v2`. Batches wait for five idle seconds, at most fifteen seconds, and analysis chunks contain at most eight messages. Message persistence and analysis run alongside each other; new messages are passed directly to model input rather than written and reread just to construct a prompt.

`conversationWorkflowV2`, `sendWorkflowV2` and `reminderWorkflowV2` carry account IDs. Activity wrappers restore the required workspace context. Workflow IDs are namespaced by account. The API embeds the activity worker; one app instance owns Telegram sessions.

## Context and AI

Mastra calls Gemma through OpenRouter for extraction, one repair attempt when needed, and editable drafts. Primary: `google/gemma-4-26b-a4b-it:free`. Configured fallback: `google/gemma-4-31b-it:free`. Configuration accepts only free Gemma IDs. Availability and quotas belong to the external providers; failed analysis remains available for retry.

Context includes both speakers, at most twenty active tasks and 24,000 message characters before fitting. New message IDs identify fresh evidence without duplicating their text. Request-local message/task aliases reduce identifier copying errors and are restored before validation. Up to four retrieved older agreement references are scoped by account/client and checked against authoritative messages. Completed/cancelled work sets a recent-context boundary while evidence for remaining active tasks is retained.

Hosted fitting has a 28,000-character budget, with bounded output and low temperature. Context shortening that affects tasks or new text forces review. Model generation is serialized per process, with a bounded pending queue. Schema, source evidence, actor responsibility, calendar interpretation and revision checks control commits. Explicit owner acceptance can create an open task; client promises create waiting tasks; uncertain requests or counteroffers remain under review. Model output never determines the sending channel.

## Storage and isolation

Tiger PostgreSQL stores account authentication, one optimistic compare-and-swap JSONB row per workspace in `ft_workspace`, encrypted Telegram credentials in `ft_channel_sessions`, and account/client-scoped pgvector/full-text chunks in `ft_chunks_v2`. Workspace rows have a 12 MB cap. Normalized entity storage and archival are needed for larger deployments.

Opaque server sessions resolve the account ID. AsyncLocalStorage carries workspace context; missing context fails closed. Clients and provider peers stay separate across channels. No automatic WhatsApp/Telegram identity merging occurs. WAHA account sessions use `ft-<account UUID>`. Encrypted Telegram credentials are separate from dashboard state and model input.

## Approval and delivery

Immediate replies use the owner's reviewed recipient and text. Scheduled follow-ups also require exact approved time, task revision and conversation sequence. New conversation activity and task changes pause approvals. Closed tasks, changed revisions and sends over fifteen minutes late cannot silently proceed. Internal reminders are dashboard notifications.

Outbox request IDs prevent repeated immediate requests from dispatching twice. Provider IDs/echoes can confirm delivery; unresolved outcomes become uncertain and are never blindly retried. Text/time echo reconciliation is a pilot heuristic rather than an exactly-once guarantee. On restart, interrupted sends become uncertain, approved schedules are re-enqueued, and existing account Telegram sessions are restored.

## Recovery and limits

Temporal activities can retry failed batches, including inference when a result was not committed. Independent inference-result checkpoints are not implemented. Telegram performs bounded newer-message recovery (up to 100) for previously captured allowed conversations; complete historical import and prolonged-offline guarantees are not implemented. WhatsApp has no complete historical backfill/reconciliation path.

The deployed Temporal server uses persistent SQLite development storage. Shared adapter leases, horizontal scaling, production HA orchestration, media analysis, group support and email recovery/MFA are outside the current implementation. Latest observations and unverified live paths are listed in [validation](../testing/VALIDATION.md).
