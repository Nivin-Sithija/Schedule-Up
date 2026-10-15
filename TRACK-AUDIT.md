# FollowThrough active target tracks — 15 October 2026

The active targets are Gemma, Mastra, Tiger Data, Temporal and Render. Sentry was removed from the plan at the owner's request. A dependency or demonstration fixture alone is not evidence of a completed integration.

| Track | Contribution | Verified evidence | Remaining demo evidence |
|---|---|---|---|
| Gemma | Understands requests, accepted commitments, dates, changes and completion; generates editable replies | Local calendar evaluation passed 15/15 scenarios. Hosted OpenRouter Gemma passed acceptance, counteroffer and client-agreement scenarios plus editable drafting after prioritized Google AI Studio BYOK was configured | Record a real hosted two-channel message-to-calendar lifecycle. These examples are not a general accuracy guarantee |
| Mastra | Executes the Gemma extraction, repair and drafting agent calls | Real local and hosted generation checks passed. Bounded context, retrieval, validation and task commits are application code around those calls | Show useful context selection, evidence guards and repair behavior; do not claim Mastra memory/tools that are not implemented |
| Tiger Data | Account-scoped authoritative state and hybrid pgvector/keyword agreement retrieval | Local database and retrieval integration checks passed. Existing workspace data was retained through deployment. A later read showed 2 clients, 10 messages and 2 tasks; local connection timeouts were intermittent, not a demonstrated hosted-data loss | Show an older agreement retrieved beyond recent messages, with source attribution |
| Temporal | Durable ordered per-client signals, retried analysis activities, reminders and approved follow-up timers | Disposable local workflow test previously demonstrated restart recovery. Hosted server and embedded worker are live, using private gRPC on 7233 | Record hosted retry/restart recovery and a paused follow-up. SQLite development-server deployment with a persistent disk is a demo configuration, not a production HA cluster |
| Render | Hosts the dashboard/API/embedded worker and private WAHA/Temporal services | All three Starter services live; scheduleup.tech HTTPS health passed and www redirects to the root. The owner confirmed hosted sign-in and both channel connections | Record the deployed demo and real workflow checks. Base cost $21.50/month plus usage extras; no peak-load test was requested |

## Submission rules for evidence

The public simulated demo is generated fictional data and remains read-only. It illustrates behavior; it does not prove model accuracy, live delivery or durability. Keep simulated screenshots distinct from actual hosted workflow results. The owner confirmed sign-in worked after an earlier HTML gateway response; error handling now converts such responses into a useful message instead of a JSON syntax error.

No payment, willingness-to-pay or customer outcome should be invented. Document genuine pilot feedback and practical limitations. Hosted Gemma uses an OpenRouter key with prioritized Google AI Studio BYOK; free provider quotas still apply. No paid model or Google billing was enabled by the agent. Existing Telegram sessions depend on the preserved encryption key. WhatsApp is QR-linked via an unofficial adapter.

## Remaining order

1. Finish the real WhatsApp and Telegram acceptance, date-change and completion tests on the hosted site.
2. Record a follow-up pause and Temporal recovery without casually restarting active sends.
3. Capture the dashboard, evidence links, shared calendar and separate scheduled tab.
4. Write the submission around missed commitments and time saved, with accurate framework contributions and deployment cost.

[Official challenge](https://dev.to/challenges/hacktoberfest-week2-2026-10-12) · [Mastra agents](https://mastra.ai/docs/agents/overview) · [OpenRouter BYOK](https://openrouter.ai/docs/guides/overview/auth/byok) · [Render deployment documentation](https://render.com/docs/deploys).
