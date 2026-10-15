# Calendar conversation scenarios

Local Gemma + Mastra extraction → Tiger persistence → the dashboard calendar function. Fixed message date: 15 October 2026, timezone Asia/Colombo. Synthetic test workspace; no provider sends or real client changes. Existing-task cases use seeded previously accepted tasks. Temporal and live transport are outside this test.

15/15 scenarios passed.

## PASS: Informal acceptance

> client: Please send the revised proposal tomorrow by 10 AM.
>
> owner: Sure I ll sent it as soon as possible

Expected: One open proposal task on 16 Oct at 10 AM; no review cards

Observed (14730 ms):

```json
{
  "tasks": [
    {
      "title": "revised proposal",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-16T04:30:00.000Z"
    }
  ],
  "calendar": [
    {
      "title": "revised proposal",
      "day": "2026-10-16",
      "status": "open"
    }
  ],
  "reviews": []
}
```

## PASS: Direct promise with reason and 24-hour time

> owner: I will send the invoice tomorrow by 14:30 because I need to check the final amount first.

Expected: Invoice on 16 Oct at 14:30, no invented extra work

Observed (10021 ms):

```json
{
  "tasks": [
    {
      "title": "send the invoice",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-16T09:00:00.000Z"
    }
  ],
  "calendar": [
    {
      "title": "send the invoice",
      "day": "2026-10-16",
      "status": "open"
    }
  ],
  "reviews": []
}
```

## PASS: Promise without a deadline

> owner: I'll send the logo artwork as soon as possible.

Expected: Open logo task without a calendar date

Observed (5633 ms):

```json
{
  "tasks": [
    {
      "title": "send the logo artwork",
      "status": "open",
      "responsible": "owner",
      "due": null
    }
  ],
  "calendar": [],
  "reviews": []
}
```

## PASS: Explicit deadline change with explanation

> owner: I will send the revised proposal on 17 October at 3 PM instead of tomorrow because the pricing needs updating.

Expected: Same task moves from 16 to 17 Oct at 3 PM, no duplicate

Observed (10536 ms):

```json
{
  "tasks": [
    {
      "title": "Send revised proposal",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-17T09:30:00.000Z"
    }
  ],
  "calendar": [
    {
      "title": "Send revised proposal",
      "day": "2026-10-17",
      "status": "open"
    }
  ],
  "reviews": []
}
```

## PASS: Counteroffer on an existing task

> owner: Can I send the revised proposal by 17th because I have another proposal tomorrow?

Expected: Existing 16 Oct task stays; proposed 17 Oct change needs review

Observed (6279 ms):

```json
{
  "tasks": [
    {
      "title": "Send revised proposal",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-16T04:30:00Z"
    }
  ],
  "calendar": [
    {
      "title": "Send revised proposal",
      "day": "2026-10-16",
      "status": "open"
    }
  ],
  "reviews": [
    {
      "title": "Send revised proposal",
      "due": "2026-10-17",
      "reason": "Owner proposed a change; client agreement is still pending."
    }
  ]
}
```

## PASS: Agreed counteroffer

> client: Please send the revised proposal tomorrow by 10 AM.
>
> owner: Can I send it by 17th because another proposal is due tomorrow?
>
> client: Yes, the 17th works. Please send it then.

Expected: Proposal automatically scheduled on 17 Oct

Observed (11128 ms):

```json
{
  "tasks": [
    {
      "title": "Send revised proposal",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-17"
    }
  ],
  "calendar": [
    {
      "title": "Send revised proposal",
      "day": "2026-10-17",
      "status": "open"
    }
  ],
  "reviews": []
}
```

## PASS: Two deliverables in one message

> owner: I will send the logo artwork tomorrow at 11 AM, and I will send the invoice on 17 October at 4 PM.

Expected: Logo on 16 Oct; invoice on 17 Oct

Observed (10934 ms):

```json
{
  "tasks": [
    {
      "title": "send the logo artwork",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-16T05:30:00.000Z"
    },
    {
      "title": "send the invoice",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-17T10:30:00.000Z"
    }
  ],
  "calendar": [
    {
      "title": "send the logo artwork",
      "day": "2026-10-16",
      "status": "open"
    },
    {
      "title": "send the invoice",
      "day": "2026-10-17",
      "status": "open"
    }
  ],
  "reviews": []
}
```

## PASS: Complete one of two tasks

> owner: I have sent the logo artwork. The invoice is still pending.

Expected: Logo closes and leaves calendar; invoice stays on 17 Oct

Observed (6559 ms):

```json
{
  "tasks": [
    {
      "title": "Send logo artwork",
      "status": "completed",
      "responsible": "owner",
      "due": "2026-10-16"
    },
    {
      "title": "Send invoice",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-17"
    }
  ],
  "calendar": [
    {
      "title": "Send invoice",
      "day": "2026-10-17",
      "status": "open"
    }
  ],
  "reviews": []
}
```

## PASS: Explicit cancellation

> owner: Cancel the revised proposal task. The client no longer needs it.

Expected: Cancelled proposal leaves active calendar

Observed (6382 ms):

```json
{
  "tasks": [
    {
      "title": "Send revised proposal",
      "status": "cancelled",
      "responsible": "owner",
      "due": "2026-10-16"
    }
  ],
  "calendar": [],
  "reviews": []
}
```

## PASS: Client owes an input

> client: I will send the product photos tomorrow by 9 AM.

Expected: Waiting on client for product photos on 16 Oct

Observed (7223 ms):

```json
{
  "tasks": [
    {
      "title": "send the product photos",
      "status": "waiting",
      "responsible": "client",
      "due": "2026-10-16T03:30:00.000Z"
    }
  ],
  "calendar": [
    {
      "title": "send the product photos",
      "day": "2026-10-16",
      "status": "waiting"
    }
  ],
  "reviews": []
}
```

## PASS: Owner refuses a request

> client: Please send the invoice tomorrow.
>
> owner: Sorry, I cannot take this job. I won't be sending an invoice.

Expected: No accepted task or calendar entry

Observed (5363 ms):

```json
{
  "tasks": [],
  "calendar": [],
  "reviews": []
}
```

## PASS: Conditional promise

> owner: If the supplier confirms stock, I might deliver the sample tomorrow.

Expected: No accepted task or calendar entry; a tentative idea may be ignored or offered for review

Observed (4529 ms):

```json
{
  "tasks": [],
  "calendar": [],
  "reviews": []
}
```

## PASS: Short correction refers to existing task

> owner: Correction: I will send it on 18 October at 11 AM, not the 16th.

Expected: Same task moves to 18 Oct at 11 AM

Observed (7506 ms):

```json
{
  "tasks": [
    {
      "title": "Send revised proposal",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-18T05:30:00.000Z"
    }
  ],
  "calendar": [
    {
      "title": "Send revised proposal",
      "day": "2026-10-18",
      "status": "open"
    }
  ],
  "reviews": []
}
```

## PASS: Tomorrow after local midnight

> owner: I will send the revised proposal tomorrow by 10 AM.

Expected: Proposal on 17 Oct despite UTC date still being 15 Oct

Observed (6948 ms):

```json
{
  "tasks": [
    {
      "title": "Send revised proposal",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-17T04:30:00.000Z"
    }
  ],
  "calendar": [
    {
      "title": "Send revised proposal",
      "day": "2026-10-17",
      "status": "open"
    }
  ],
  "reviews": []
}
```

## PASS: Duplicate delivery of a message

> owner: I will send the revised proposal tomorrow.

Expected: Only one calendar task after processing the same message twice

Observed (6900 ms):

```json
{
  "tasks": [
    {
      "title": "send the revised proposal",
      "status": "open",
      "responsible": "owner",
      "due": "2026-10-16"
    }
  ],
  "calendar": [
    {
      "title": "send the revised proposal",
      "day": "2026-10-16",
      "status": "open"
    }
  ],
  "reviews": []
}
```
