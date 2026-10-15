# ScheduleUp

ScheduleUp turns allowed WhatsApp and Telegram conversations into an evidence-linked task timeline for a business owner. It tracks owner commitments, client inputs, agreed deadlines, changes and completion. AI proposes changes and drafts replies; application rules validate task updates, and the owner approves outgoing messages.

**Live product:** https://scheduleup.tech

**Repository:** https://github.com/Nivin-Sithija/Schedule-Up

**Documentation checked:** 15 October 2026

## Product

- Account registration, sign-in, isolated workspaces and connection settings.
- Personal WhatsApp through QR-linked WAHA; personal Telegram through embedded GramJS.
- Allowed-client conversations with both speakers, channel filters and source-message evidence.
- Tasks, a four-day deadline calendar, review requests and internal reminders.
- Editable AI reply drafts, reusable templates, reviewed immediate replies and approved scheduled follow-ups.
- Public read-only simulated demo, separate from account data.

## Deployed services

| Component | Current implementation |
|---|---|
| Web app | React dashboard served by Fastify; one Render app instance with its embedded Temporal worker and Telegram adapter |
| WhatsApp | Private Render WAHA service with persistent session disk |
| Workflows | Private Render Temporal development server with persistent SQLite history disk |
| Storage | External Tiger Data PostgreSQL; account state, encrypted Telegram sessions and pgvector/full-text retrieval |
| AI | Mastra agents using OpenRouter Gemma; primary `google/gemma-4-26b-a4b-it:free`, configured fallback `google/gemma-4-31b-it:free` |

The 15 October recheck passed live HTTPS, frontend assets, protected-route access control, database connectivity, primary inference, structured extraction, all 93 regressions and the production build. **Fallback inference is degraded:** its three probes returned HTTP 504/502. Private channel delivery and hosted workflow recovery were not exercised in this recheck. See the [validation report](docs/testing/VALIDATION.md).

## Documentation

Start with the [documentation index](docs/README.md), [system diagram](docs/architecture/SYSTEM-OVERVIEW.md), [use-case diagram](docs/architecture/USE-CASES.md), [product guide](docs/guides/PRODUCT.md) and [deployment operations](docs/deployment/HOSTING.md).

## Repository and verification

`src/` contains the API, channel adapters, workflows and React UI. `tests/` contains regression tests; `infra/` and `render.yaml` define hosting; `scripts/` contains deployment and evaluation helpers. Secrets and generated local state are ignored.

```sh
npm ci
npm test
npm run build
```

Deployment runs through GitHub Actions after checks and container verification. Production requires PostgreSQL, Temporal, OpenRouter credentials and channel configuration. See the operations guide for the deployed configuration; start only one API with its embedded worker.

## Scope and attribution

This is a single-instance pilot. Telegram supports private text/captions; WhatsApp capture supports live text. Media analysis, groups, cross-channel identity merging, complete historical import, password recovery and MFA are not implemented. Temporal uses its development server rather than a production HA cluster. Unknown delivery outcomes need inspection before retry.

Kairo Platform supplied by the owner informed the inbox/composer/evidence layout and WAHA integration patterns. ScheduleUp is a separate TypeScript implementation. Third-party packages, WAHA, Temporal, GramJS and the embedding model retain their licenses.
