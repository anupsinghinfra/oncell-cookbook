---
title: The Agent that Takes Out Its Own Trash
description: The self-maintenance cadence on OnCell — a weekly wake that applies declared retention rules to the agent's own database and files, with an exact accounting of every purge.
date: 2026-08-01
slug: data-retention-janitor
---

# The Agent that Takes Out Its Own Trash

Durable state is the whole point of a real agent runtime — and durable state has a failure mode nobody writes blog posts about: it *accumulates*. The event table that grows by ten thousand rows a day. The reports directory with four hundred dated files. The memory keys for users who churned last year. Every long-lived system needs garbage collection, and agents are no exception; they're just the newest system whose owners haven't been burned yet.

The traditional answer is a cleanup script — written after the first scary disk-usage graph, run by hand twice, then forgotten until the next graph. Retention becomes archaeology: nobody remembers what's safe to delete, so nothing is deleted, so a GDPR question ("how long do you keep this?") gets answered with a shrug.

`data-retention-janitor` demonstrates the **self-maintenance cadence**: a scheduled chain where the agent is its own operand. The weekly `sweep` wake doesn't monitor an external system or message a human — it turns around and cleans the agent's own SQLite tables and its own files, then re-books itself. In a collection full of agents watching certs, PRs, and KPIs, this one watches its own disk.

## Policy is state, not code

The retention rules live in one memory key, set by a zero-LLM task:

```js
await agent.memory.set("retention_rules", { events_days: eventsDays, reports_keep: reportsKeep });
```

That placement is a deliberate design position: changing your retention policy should never mean redeploying an agent. Tighten `events_days` from 90 to 30 with one free call, and next Sunday's sweep enforces it. And the identity in [`agent.js`](agent.js) closes the dangerous default:

> "Missing rules mean nothing is purged - you never guess a retention policy."

A janitor that improvises about deletion is a data-loss incident on a timer. This one treats the absence of policy as a hard stop — the sweep still runs, still writes a report, and the report says *rules missing, nothing deleted*.

## Deletion is mechanical; accounting is the deliverable

The sweep itself is deliberately unexciting — `DELETE FROM events WHERE created_at < cutoff`, drop the oldest reports beyond `reports_keep`, all through direct SQL and file operations because "deletion is mechanical work, not judgment." That's why the whole agent runs on `claude-haiku` at `perDayCents: 40` — the cheapest budget in this collection, for an agent that runs one short pass a week.

The part with standards is the report. Every sweep writes `reports/YYYY-MM-DD.md`: rows deleted *and the cutoff used*, files deleted *by name*, what remains, and the rules as currently set. Count before, count after, state exact numbers. When the compliance question comes, `last-sweep` (a zero-token file read) answers it with receipts. There's a pleasing recursion here, too: the sweep reports are themselves subject to `reports_keep` — the janitor's own paper trail is on the retention schedule it enforces.

One boundary sentence does quiet but important work: "You only ever touch your own tables and your own files. Nothing outside your cell is yours to clean." Self-maintenance means *self*.

The chain follows the repo's conventions: `start` clears `janitor_stopped` and runs one sweep (booking next week's); `stop` is a zero-LLM flag the pending wake reads and obeys — coordination through state, no cancellation. The smoke task is `set-rules`: configuring policy must never arm the infinite chain; `start` is that decision, made explicitly.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy data-retention-janitor
```

Declare policy, feed it data, arm it:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/data-retention-janitor/set-rules \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"events_days": 30, "reports_keep": 12}'

curl -X POST .../data-retention-janitor/log-event -d '{"kind": "page_view", "payload": "/pricing"}'
curl -X POST .../data-retention-janitor/start -d '{}'
```

`log-event` is the zero-token ingest path — point any firehose at it. Every Sunday after that, one line in the run log: `31,204 rows purged, 1 file purged, next sweep in 7 days`, with the receipts in `reports/`.

## What you didn't have to build

A cleanup script that rots in a `scripts/` directory. A cron entry someone has to remember exists. A config file redeploy for every policy change. An audit trail for deletions. The discipline to never delete without a declared rule.

You wrote two retention numbers and a report format. The agent keeps your data honest — starting with its own.
