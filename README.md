# ScheduleUp

**The most expensive task manager for a side hustle is the one in your head.**

`#devchallenge` · `#hf26challenge` · `#opensource` · `#automation`

[![Watch the ScheduleUp demo on YouTube](https://i.ytimg.com/vi/BBVBgigOgeU/maxresdefault.jpg)](https://youtu.be/BBVBgigOgeU)

*This is a submission for the [Hacktoberfest Open-Source AI Challenge Week 2: Side Hustle](https://dev.to/challenges/hacktoberfest-week2-2026-10-12)*

## What I Built

You finish a client call, open WhatsApp, and type:

> “Sure, I’ll send the updated menu tomorrow by 4.”

Then another client messages on another channel or in another conversation. Someone asks for a quote. Someone else promises to send the product photos. Three conversations later, those menu deadlines and tasks are forgotten. Typically, you manually note everything down, one by one, but when you’re running a side hustle, it’s really hard to keep track of it all, all the time.

**ScheduleUp automatically tracks commitments and deadlines from allowed WhatsApp and Telegram conversations, so you save time without remembering every promise or taking messy notes.**

The intended customer is a solo designer, developer, consultant, or small service-business owner who coordinates work through chat and keeps having to copy it into another tool.

Here is the behavior I care about:

| What happens in chat | What ScheduleUp should record |
| --- | --- |
| A client asks for an extra quote | A request to review |
| The owner accepts the work | An open owner task |
| The client promises to send photos | A waiting task assigned to the client |
| Both sides agree to a later deadline | An updated task with supporting messages |
| Work is explicitly completed or cancelled | A historical record, removed from active work |

ScheduleUp also provides editable reply drafts, reusable templates, internal reminders, and approved scheduled follow-ups. The owner reviews outgoing messages.

## Demo

**Web demo:** [scheduleup.tech](https://scheduleup.tech/)

**⚡ Hackathon Judges Fast-Pass:** Click **“Explore the simulated demo”** on the sign-in screen to instantly explore pre-loaded sample conversations, tasks, and deadlines—no account or WhatsApp/Telegram connection needed!

**Video walkthrough:** [Watch on YouTube](https://youtu.be/BBVBgigOgeU)

## Code

**Repository: [Nivin-Sithija/Schedule-Up](https://github.com/Nivin-Sithija/Schedule-Up)**

To inspect the project and run its checks with Node.js 22:

```bash
git clone https://github.com/Nivin-Sithija/Schedule-Up.git
cd Schedule-Up
npm ci
npm test
npm run build
```

## How I Built It

### Gemma interprets the conversation

ScheduleUp uses **Google's open-weight Gemma models through OpenRouter**, orchestrated by **Mastra**.

The deployed primary model is `google/gemma-4-26b-a4b-it:free`. It receives both sides of a permitted conversation, current tasks, relevant older context, and calendar information tied to each message.

It proposes structured changes to create, update, complete, or cancel a task.

The application then checks the schema, evidence, responsibility, dates, and task revisions before accepting a change. Ambiguous requests and counteroffers can stay under review. Invalid output gets one repair attempt, followed by the same checks.

### Remembering an agreement without replaying the entire inbox

Older context lives in **Tiger Data PostgreSQL**, using **pgvector plus PostgreSQL full-text search**.

The app runs the quantized `Xenova/all-MiniLM-L6-v2` embedding model through Hugging Face Transformers.js inside its own process. Keyword and vector results are combined to retrieve relevant older agreement references, scoped to the current workspace and client.

### Follow-ups need a memory

**Temporal** coordinates conversation batches, analysis activities, reminders, and approved-send timers.

An incoming permitted message becomes a durable workflow signal. Analysis runs in ordered batches. Scheduled follow-ups check the approved recipient, text, time, task revision, and conversation sequence before sending.

New chat activity or task changes pause existing follow-up approvals. An uncertain delivery outcome needs inspection before retry; the app does not blindly send another copy.

The pilot uses Temporal's development server with persistent SQLite storage. Hosted restart recovery still needs direct verification.

### The deployed stack

![ScheduleUp architecture showing Render hosting, channel adapters, Temporal, Mastra, hosted Gemma inference, and Tiger Data storage](https://dev-to-uploads.s3.us-east-2.amazonaws.com/uploads/articles/hpol48sw5byo1mkygvgd.png)

Render is used to host the services. Tiger Data and OpenRouter are external dependencies.

GitHub Actions runs build, test, dependency-audit, and container checks before deployment.

## Why Does Open Innovation Matter?

For a side-hustle tool, AI needs to be affordable to use repeatedly and adaptable to real client conversations. Open components give ScheduleUp three concrete advantages:

- **Local conversation search:** An open embedding model runs inside the app to retrieve earlier agreements. No separate embedding API, per-request embedding charge, or additional provider receiving that text.
- **Control over inference:** Gemma's open weights provide a route to customer-controlled inference. ScheduleUp includes an Ollama adapter, allowing the reasoning to move onto hardware the customer controls. This offers an alternative if hosted API pricing, availability, or privacy requirements change.
- **Editable agent behavior:** Mastra's open-source framework lets me inspect and modify extraction, repair, and drafting. Application rules check evidence and deadlines before accepting task changes.

### 💸 LLM-call costs

A conversation can trigger extraction, a repair attempt, and a requested reply draft—each a separate LLM call. With metered inference, those calls contribute to the cost of serving every customer.

### More Follow-Through, Less Overhead

Open-source AI isn't just about matching proprietary models on benchmark leaderboards. It is about **giving a small business control over the cost and behavior of the tools it depends on.**

ScheduleUp combines open-weight reasoning, local conversation search, and editable agent workflows to turn client messages into commitments you can trace and manage. The business still needs pricing validation, but its core processing can evolve beyond a single hosted AI provider.
