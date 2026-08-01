---
title: The Subscription Auditor that Wakes Up Once a Month
description: The long-period cadence on OnCell — a 30-day wake chain that sweeps the SaaS ledger, flags zombies, and gates every cancellation behind ask_human.
date: 2026-08-01
slug: subscription-auditor
---

# The Subscription Auditor that Wakes Up Once a Month

Every company past twenty people is paying for software nobody uses. The seat someone kept after switching teams. The tool the churned PM signed up for. The "we'll evaluate it this quarter" platform, eighteen months later. SaaS spend audits reliably find 10-30% waste — which is why every finance team plans a quarterly review, and why almost none happen twice. Recurring work with a long period is the first thing a busy team drops, and the cron job version rots even faster: a script on a box, running quarterly, whose owner left. Nobody notices a quarterly job failing for a year.

`subscription-auditor` is that review as a permanent employee — one who works a single day a month. It demonstrates the **long-period cadence**: the same self-rebooking chain as a daily digest or a 5-minute watchdog, stretched to 30 days, and the stretching costs nothing. The audit pass in [`agent.js`](agent.js) ends with:

> "Then call schedule with in set to 30 days and note set to audit."

A durable wake intent doesn't care how far out it is. For 29 days the agent is a ledger entry — no process, no memory footprint, $0 — and the wake fires regardless of how many times you redeploy in between. This is precisely where OnCell's `schedule` beats infrastructure you run yourself: short-period jobs fail loudly, long-period jobs fail silently, and a runtime-owned wake can't fail to exist.

## Zombies, defined in one sentence

The judgment is deliberately legible:

> "A subscription is a zombie when status is active AND (last_used is empty or older than 60 days, or owner is empty)."

The data feeding that rule arrives through two zero-LLM tasks. `upsert-subscription` syncs the ledger (from your expense tool, a spreadsheet export, wherever) as plain SQLite upserts. `mark-used` is the interesting one — wire your SSO login events or expense-report feed to it, and usage signals stream in all month at zero token cost:

```js
await agent.db.sql`UPDATE subscriptions SET last_used = ${new Date().toISOString()} WHERE vendor = ${vendor}`;
```

By audit day the table already knows who's a zombie. The model's monthly job is the part that deserves a model: compute annual costs, compose the flagged list, and talk to a human.

## The human is on the trigger, not in the loop

An agent that cancels software on its own judgment is a horror story with one plot. The identity draws the line in ink: `draft_cancellation` is "gated behind human approval, never called on your own judgment." Mechanically, the audit wake flags zombies and then parks — one `ask_human` call carrying the full flagged list with annual costs and days-idle — and the run suspends at $0 until a person answers. Approve Figma and Datadog? Two drafts are written (to a stub you wire to your drafts folder — a human still hits send), rows flip to `cancelling`. Decline the others? They go back to `active` with `last_used` refreshed, so next month's audit doesn't re-litigate them. The park can sit for a week; nothing burns.

Note it's *one* `ask_human` for the whole list, not one per vendor — a monthly agent should cost one decision, not a decision spree.

## Start, stop, smoke

The chain arms explicitly: `start` clears the stop flag and runs the first audit (which books day 30). `stop` is a zero-LLM memory write that the next wake reads and obeys — coordination through state, the repo's convention for every stoppable chain, no cancellation API involved. And the smoke task is `upsert-subscription`: syncing a ledger row must never arm a 30-day chain as a side effect.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy subscription-auditor
```

Sync the ledger (zero tokens):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/subscription-auditor/upsert-subscription \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"vendor": "Figma", "amount_usd": 540, "cadence": "monthly", "owner": "design"}'
```

Arm it once — `curl -X POST .../start -d '{}'` — and next month a single message arrives: total annual spend, the zombie list with dollar figures, and a question. Answer it, and the drafts appear. `ledger` gives you the zero-token view any day in between.

## What you didn't have to build

A quarterly cron that dies unnoticed. A usage-tracking pipeline with its own database. An approval workflow tool. A worker that waits a week for the CFO to reply without burning compute. Guardrails keeping automation's hands off the cancel button.

You wrote a zombie rule and a question. The runtime remembers the 30 days, and the human keeps the trigger.
