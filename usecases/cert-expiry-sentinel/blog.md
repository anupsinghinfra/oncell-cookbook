---
title: The Cert Sentinel that Counts Down Instead of Polling
description: Deadline-countdown scheduling on OnCell — wakes computed to land at the exact 30/7/1-day threshold instants, not a cron that checks and hopes.
date: 2026-08-01
slug: cert-expiry-sentinel
---

# The Cert Sentinel that Counts Down Instead of Polling

Every ops team has the story: the wildcard cert that expired on a Saturday, the domain that lapsed because the renewal email went to someone who left. The standard fix is a cron job that scans a spreadsheet daily and emails when something is "close." It works until the cron box dies, or until "close" fires the same warning fourteen days in a row and everyone filters it to a folder.

The deeper problem is that expiry is not a cadence problem. A certificate expiring November 15th has three moments that matter — October 16th, November 8th, November 14th — and a daily poll is just a blunt instrument for hitting them. You are running 365 checks a year to catch 3 instants you could have computed in advance.

`cert-expiry-sentinel` computes them. This is the **deadline countdown** pattern: instead of waking on a fixed cadence and asking "is anything due?", the agent calculates each cert's next threshold instant — `expires_at` minus 30, 7, or 1 days — and books a wake with `at` set to that exact ISO timestamp. OnCell's `schedule` tool takes either a relative `in` or an absolute `at`; countdown agents live on `at`.

## A surveyor and its stakes

The agent has two kinds of wake, distinguished by the note the runtime hands back as the prompt. From the identity in [`agent.js`](agent.js):

> "A note reading scan means: ... walk every active cert, apply the warning rule, plant a check &lt;domain&gt; wake for each cert whose next threshold instant is within 7 days, then call schedule with in set to 7 days and note set to scan."

The weekly `scan` is the surveyor. It re-books itself on a plain cadence, but its real job is planting precise stakes: for any cert entering its final month, week, or day within the coming seven days, it schedules a `check <domain>` wake at the computed instant. When that wake fires, the agent re-reads the row, confirms the threshold is still due, sends one escalating alert — `notice` at 30 days, `warning` at 7, `critical` at 1 — and plants the next stake if it is already in range.

The `warned_level` column is what makes the warnings escalate instead of repeat: the agent only alerts when the due threshold is *tighter* than the last one warned, then records it. Three warnings per cert, ever, each more urgent than the last.

## Renewals cancel nothing — and that is the trick

What happens to a pending countdown wake when you renew the cert early? Nothing — and that is deliberate. The `renewed` task is pure primitives, zero LLM:

```js
await agent.db.sql`UPDATE certs SET expires_at = ${expiresAt}, warned_level = 0 WHERE domain = ${domain}`;
```

The old wake still fires, but the wake procedure recomputes days-left from the *current* `expires_at`, finds nothing due, and stands down in one line. Coordination through state: you never chase down scheduled work to cancel it; you change the state it will read when it wakes. The same mechanism powers the kill switch — `stop` flips one memory key, `sentinel_stopped`, and every pending wake checks it first.

Note what the ingest path costs: `add-cert`, `renewed`, `list`, and `stop` never touch the model. Registering fifty certs is fifty SQLite inserts. The LLM only runs when there is judgment involved — walking the table, wording an alert — capped at `maxSteps: 24, maxCost: 0.4` per pass under a $0.50/day identity budget.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy cert-expiry-sentinel
```

Load the table (zero tokens):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/cert-expiry-sentinel/add-cert \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "api.myapp.example", "kind": "tls-cert", "expires_at": "2026-11-15T00:00:00Z"}'
```

Then arm it once — `curl -X POST .../start -d '{}'` — and the surveyor takes over: one scan a week, precise stakes in between. `stop` stands the whole thing down; `start` re-arms it. (The smoke task is `add-cert` on purpose — ingest never starts the chain; arming is an explicit decision.)

## What you didn't have to build

A daily poller and the host it runs on. A job store for one-shot timers that survives deploys. De-duplication so the 30-day warning does not fire thirty times. A cancellation API for renewals. Cost caps on the whole thing.

You wrote a warning rule and a subtraction. The runtime owns the calendar.
