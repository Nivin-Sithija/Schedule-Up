# Hosted acceptance scenarios

These are checks for the implemented product, not claims of completed live tests. Latest completed observations are in [validation](VALIDATION.md). Use an owner-controlled test conversation and record channel, timestamp, observed task/evidence, deadline and outcome without publishing private messages or numbers.

| Scenario | Expected behavior |
|---|---|
| Client request without owner acceptance | Review rather than an invented owner commitment |
| Owner accepts a dated request | Open owner task citing request and acceptance |
| Client promises an input | Waiting task assigned to client |
| Counteroffer followed by agreement | Proposed date reviewed; agreed date replaces the prior deadline |
| Multiple deliverables | Separate supported tasks without repeated unchanged work |
| Explicit date/time and midnight boundary | Calendar uses message-local Asia/Colombo date and preserves explicit times |
| Completion or cancellation | Task leaves active calendar and remains in history |
| Duplicate provider event | Existing message/task is not duplicated |
| Different channels | Source badges and filters retain channel identity |
| New chat after scheduled approval | Approved follow-up pauses before analysis |
| Task revision changes | Old schedule cannot send against changed work |
| Reviewed immediate reply | Exactly the chosen text goes through the original channel |
| Uncertain provider outcome | No blind retry; require inspection |
| Inference outage | Pending input retained for retry; no invented task |
| App restart | State retained; interrupted sends uncertain; approved timers restored |
| Temporal recovery | Durable input resumes after a controlled interruption without duplicate committed work |

Perform send/recovery cases only with explicit owner-approved recipients/text/time and a controlled window without active customer sends. Record actual results separately. Read-only demo data and automated rule tests do not establish provider delivery or hosted recovery.
