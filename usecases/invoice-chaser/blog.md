---
title: An Invoice Chaser that Sleeps Seven Days at a Time — for Free
description: Politely escalating payment reminders built on durable wake intents, a SQLite paper trail, and a human gate before anything drastic.
date: 2026-08-01
slug: invoice-chaser
---

# An Invoice Chaser that Sleeps Seven Days at a Time — for Free

Somewhere in your company there is a spreadsheet tab called "AR chasing" and a founder who opens it every Friday with dread. Chasing invoices is the most automatable job in the building — the emails follow a script, the escalation follows a ladder, the stop condition is a bank notification — and yet it stays manual, because the automation has a shape software teams hate: *do a tiny thing, then do nothing for a week, then remember perfectly.*

"Do nothing for a week" is the expensive part. A worker process that sleeps seven days is a worker you're paying for and praying over. A cron job that scans a database for due nudges is a scheduler, a state machine, and an idempotency puzzle ("did the Tuesday run already email them?") wearing a trench coat. Most teams look at that stack, sigh, and go back to the spreadsheet.

`invoice-chaser` gets the whole loop into one file because sleeping is the runtime's job.

## Each nudge books the next

Look at how the `chase` task ends, per the identity instructions in [`agent.js`](agent.js):

> "...send the first warm nudge with send_email, set nudge_count to 1, and call schedule with in set to 7 days and note set to nudge <invoice_ref>."

That `schedule` call writes a durable wake intent into the runtime's park ledger and the run *finishes*. Nothing polls. Nothing sleeps in a process. Seven days later the runtime starts a fresh run with `nudge INV-2041` as its prompt, and the identity says exactly what a wake means: read the row; if it's paid, stand down; otherwise send the next email on the tone ladder and book the next wake. The chain survives crashes, redeploys, and host replacement, because the intent belongs to the runtime — the agent only ever expresses it.

The tone ladder itself is three sentences of identity — warm, then firm, then final — with a hard rule after it: "Never send a fourth email without a human."

## The stop condition costs zero tokens

The moment payment lands, you call `payment-received` — and notice what's *not* in this handler:

```js
agent.task("payment-received", async (args) => {
  ...
  const result = await agent.db.sql`UPDATE invoices SET status = 'paid' WHERE invoice_ref = ${ref} AND status = 'open'`;
  return result.changes > 0
    ? "Marked " + ref + " paid. The scheduled nudge will stand down when it wakes."
    : "No open invoice " + ref + " found - nothing to do.";
});
```

No LLM call at all. It flips one SQLite row using the tagged-template `db` primitive, and the coordination happens through state, not through cancellation: the already-booked wake still fires next week, reads `status = 'paid'`, and quietly stands down. No race conditions, no "cancel the timer" API to get wrong. The `status` task is the same trick in read form — the whole chase ledger, zero tokens.

## A human before anything drastic

After three nudges, the identity routes around itself:

> "...if nudge_count is 3 or more, call ask_human asking whether to hand this invoice to collections..."

`ask_human` parks the run at $0 until someone answers in the dashboard — minutes or days later — and the agent then either sends a short handoff notice or records the human's reason and stops. An agent that emails your customers about money should have exactly this shape: fluent in the routine 90%, structurally incapable of freelancing the last 10%. The `perDayCents: 200` budget backstops the whole thing at $2/day of inference, enforced at the metering boundary.

`send_email` is the one stub — a custom tool you point at SES or Postmark. It lives in source; the manifest carries only `db`, `schedule`, and `ask_human`.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy invoice-chaser
```

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/invoice-chaser/chase \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"invoice_ref": "INV-2041", "customer": "Blue Harbor LLC", "email": "ap@blueharbor.example", "amount_usd": 1800}'
```

Back comes `chasing INV-2041, next nudge in 7 days`. When the money arrives, `curl .../payment-received -d '{"invoice_ref": "INV-2041"}'` — and the machine stands down.

## What you didn't have to build

A scheduler with seven-day timers that outlive your deploys. A worker to host it. An idempotency layer for double-fired nudges. A state machine for the escalation ladder. An approval queue for the collections decision. A ledger — the `invoices` table and the run log are the audit trail.

You wrote a tone ladder and a table schema. The runtime does the waiting, which was the whole problem.
