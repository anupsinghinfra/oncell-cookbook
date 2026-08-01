---
title: Sample Daily, Think Weekly — the Two-Speed Rank Tracker
description: Two-speed telemetry on OnCell — a haiku-cheap daily ingest chain and a weekly trend-report chain running over the same SQLite table.
date: 2026-08-01
slug: seo-rank-tracker
---

# Sample Daily, Think Weekly — the Two-Speed Rank Tracker

Rank tracking has a resolution problem. Check your keywords weekly and you can't tell Tuesday's Google update from ordinary drift — the data is too coarse to explain anything. Check daily and *read* it daily, and you become the person who announces "we dropped two spots!" every morning about a metric that wiggles two spots for breakfast. The SERP-tracker SaaS answer is a dashboard you pay $99/month to feel anxious about.

The underlying mistake is treating sampling and sense-making as one activity. They're different jobs with different natural frequencies: positions should be *recorded* often (data you didn't collect is gone forever) and *interpreted* rarely (trends only exist across many samples).

`seo-rank-tracker` runs them on separate clocks. This is **two-speed telemetry**: a fine-grained ingest cadence and a coarse analysis cadence, implemented as two independent wake chains over the same SQLite table. The daily `check` wake calls `serp_lookup` (a stub — wire it to DataForSEO or Serpapi) for every tracked keyword and inserts one `positions` row each, then re-books itself in 1 day. The weekly `trend` wake reads the accumulated series and writes `reports/YYYY-Www.md`, then re-books itself in 7 days. Same table; the fast chain only writes it, the slow chain only reads it.

## Why haiku carries this agent

The daily loop is pure mechanism — look up, insert, repeat. Following the repo's convention for uptime-style loops, the whole agent runs on `claude-haiku` with a `perDayCents: 60` ceiling and `maxCost: 0.2` per pass. Thirty daily samples of fifty keywords cost less than one month of that dashboard subscription. Even the weekly report stays in haiku range, because the identity in [`agent.js`](agent.js) does the editorial thinking in advance:

> "a move of 3 or more spots is worth a line, a move into or out of the top 10 is worth a highlighted line, everything else is a table row. Never dramatize a 1-spot wiggle."

The judgment is compiled into rules, so the model applies taste instead of inventing it — the difference between a report you skim and one you mute. `position 0 means not found in the top 100` keeps the schema honest about disappearances, which are the most important data points a rank tracker owns.

## The free surfaces

Everything outside the two wakes costs zero tokens. Adding a keyword:

```js
await agent.db.sql`INSERT OR IGNORE INTO keywords (keyword, added_at) VALUES (${keyword}, ...)`;
```

Reading a raw series back (`history`) is a `SELECT ... LIMIT 30`. And the chains follow the collection's start/stop convention: `start` runs one check pass (arming the daily chain) and books the first `trend` seven days out — one call arms both clocks. `stop` is a zero-LLM flag flip (`tracker_stopped`) that both pending wakes read and obey; nothing is cancelled, the chains stand down through state. The smoke task is `track`, because adding a keyword must never start an infinite chain.

There's a subtle dependency worth naming: the weekly report is only as good as the daily chain is faithful. That's why the check wake re-books *unconditionally* — a failed SERP call still books tomorrow, because the fast chain's one duty is to never leave holes in the series for the slow chain to trip over.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy seo-rank-tracker
```

Load your keywords (zero tokens):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/seo-rank-tracker/track \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "durable agent runtime"}'
```

Arm both clocks once — `curl -X POST .../start -d '{}'`. The daily line in the run log is almost boringly cheap: `43 keywords logged`. Sunday's line is the one you read: *biggest riser: "agent scheduling" 18 → 9; biggest faller: "cron alternative" 6 → 14* — with the full table waiting in `reports/`.

## What you didn't have to build

A cron box for the sampler and another schedule for the report. A time-series store. Rate-limit-aware polling infrastructure. The editorial restraint not to email you about wiggles. Cost control on a loop that runs 365 times a year.

You wrote an insert, a taste rule, and two cadences. Sample daily, think weekly — the runtime keeps both clocks honest.
