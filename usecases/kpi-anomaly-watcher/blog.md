---
title: The KPI Watcher that Mostly Says Nothing
description: The wake-and-compare pattern on OnCell — a daily wake rebuilds per-metric z-score baselines in memory and alerts only when a number is genuinely weird.
date: 2026-08-01
slug: kpi-anomaly-watcher
---

# The KPI Watcher that Mostly Says Nothing

The dashboard problem is not that you lack numbers. It is that someone has to *look* at them, every day, and remember what normal looks like. So teams build the daily-metrics email — and unsubscribe from it within a month, because a report that fires when nothing happened is spam with charts. Meanwhile the actual anomaly, the Tuesday signups fell 60%, sat in row four of a table nobody opened.

Static thresholds don't save you ("alert if signups < 100" — until seasonality makes that normal), and full anomaly-detection platforms are a lot of vendor for one question: *is any of my numbers out of line with its own history?*

`kpi-anomaly-watcher` answers exactly that question, once a day, and its defining behavior is silence. This is the **wake-and-compare** pattern: the scheduled wake is not a report generator. It wakes, rebuilds each metric's baseline, compares today against it, and — most days — says "all quiet" to nobody and goes back to sleep. The cadence doesn't exist to produce output; it exists to keep the baseline honest.

## Ingest is free; judgment is daily

The division of labor in [`agent.js`](agent.js) is stark. The `record` task — the one your product hits constantly — is pure primitives:

```js
await agent.db.sql`INSERT INTO metrics (metric, value, recorded_at)
  VALUES (${metric}, ${value}, ${new Date().toISOString()})`;
```

Zero tokens, however many rows you throw at it. Point a webhook or a nightly ETL step at it and forget it. The model runs exactly once a day, on the `watch` wake, and even then it is told to behave like an analyst, not a calculator:

> "Use SQL aggregates (AVG, COUNT, and mean of squares to derive std) to compute each baseline; do not eyeball rows."

The baseline — trailing 14-day mean, standard deviation, sample count — is computed *in SQLite* and cached under `baseline:<metric>` in durable memory. The alert rule is numeric and explicit: absolute z-score ≥ 2.5, and never on a metric with fewer than 5 trailing values. That warm-up clause matters — a new metric's first week produces garbage baselines, and an anomaly watcher that cries wolf during onboarding is deleted during onboarding.

Because the daily pass is arithmetic plus at most a few `send_alert` calls, the whole agent runs on `claude-haiku` with a `perDayCents: 40` ceiling and `maxCost: 0.15` per pass — the repo's convention for high-frequency mechanical loops. This watcher costs less per month than one incident postmortem coffee.

## The chain, and its off switch

The wake procedure ends the same way every steady-cadence agent here does: `schedule` with `in` = 1 day, note = `watch`. The runtime records a durable wake intent and starts a fresh run tomorrow with that note as the prompt — no cron host, nothing resident between passes, and the chain survives redeploys because it lives in the runtime's ledger, not in a process.

`stop` is the zero-LLM stand-down flag: one memory write (`watcher_stopped = true`) that tomorrow's wake reads before doing anything. `start` clears it and runs a pass, re-arming the chain. And the smoke task is `record`, deliberately: ingesting a data point must never start an infinite chain. Arming the watcher is an explicit, one-time decision.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy kpi-anomaly-watcher
```

Stream numbers in (zero tokens):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/kpi-anomaly-watcher/record \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"metric": "signups", "value": 143}'
```

Arm it once — `curl -X POST .../start -d '{}'` — then stop watching the dashboard. For weeks the agent's run log reads `all quiet ... all quiet ... all quiet`, each line a fraction of a cent. Then one morning `send_alert` fires: *signups fell to 41 against a baseline of 138 (z = -3.1)* — one sentence, one metric, the day it actually happened. `baselines` gives you a zero-token peek at what the agent currently considers normal.

## What you didn't have to build

An ingestion API and a database for the series. A stats job on a cron host. A cache for baselines that survives restarts. Warm-up logic so new metrics don't page anyone. The restraint — the hardest part of any alerting system — not to send a daily email.

You wrote a z-score rule and the sentence "schedule tomorrow." The watcher's silence is now a feature with an SLA.
