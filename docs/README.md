# ScheduleUp documentation

These documents describe the deployed product and implemented behavior as checked on **15 October 2026**. Historical setup notes, competition plans and superseded deployment instructions have been removed.

| Document | Purpose |
|---|---|
| [Product guide](guides/PRODUCT.md) | Accounts, channel setup, conversations, tasks and approved sends |
| [System overview](architecture/SYSTEM-OVERVIEW.md) | Current services, boundaries and system diagram |
| [Architecture](architecture/ARCHITECTURE.md) | Intake, inference, persistence, isolation and recovery |
| [Use cases](architecture/USE-CASES.md) | Actors, supported user actions and use-case diagram |
| [Hosting](deployment/HOSTING.md) | Live Render inventory, configuration and deployment operations |
| [Security and CI](deployment/SECURITY-AND-CI.md) | Implemented protections and release checks |
| [Validation](testing/VALIDATION.md) | Latest observations, inference issue and unverified paths |
| [Acceptance scenarios](testing/CALENDAR-SCENARIOS.md) | Hosted workflow checks and evidence requirements |
| [Simulated demo](guides/DEMO.md) | Read-only fictional walkthrough |

Diagrams are provided as PNG, editable SVG and Mermaid source. Regenerate the PNG/SVG assets with `python3 scripts/render-architecture.py` (Pillow required).
