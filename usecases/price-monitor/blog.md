---
title: A Price Monitor that Keeps Receipts
description: A daily competitor-price watcher on claude-haiku — SQLite history, threshold alerts, and a self-booked tomorrow, all in one file.
date: 2026-08-01
slug: price-monitor
---

# A Price Monitor that Keeps Receipts

You found out your competitor cut prices from a customer. On a sales call. Three weeks after it happened. Everyone has a version of this story, and everyone has the same half-fix: a bookmark folder called "competitors" that gets opened four times a year, or a browser extension that emails someone who left the company.

The real fix is boring and continuous: look at the same pages every day, write down what you saw, and say something *only* when the number moves enough to matter. Boring-and-continuous is exactly what software is for — except this particular job needs a scheduler that fires forever, a database that accumulates forever, and a notion of "enough to matter" per product. Suddenly the boring job has a Terraform directory.

`price-monitor` compresses all of it into one file, and runs on `claude-haiku` because a watcher that speaks once a week shouldn't cost dollars a day to stay silent.

## The history is a real table

The identity in [`agent.js`](agent.js) declares two SQLite tables the agent creates itself: `products` (what to watch and each product's `threshold_pct`) and `prices` (every observation, forever). Each daily `check` pass appends a row per product before it judges anything. That ordering matters: the record is unconditional, the alert is conditional. Months from now the history is there for repricing analysis whether or not anything ever "mattered" — and reading it costs zero tokens:

```js
agent.task("history", async (args) => {
  ...
  const result = await agent.db.sql`SELECT price_usd, checked_at FROM prices WHERE product = ${name} ORDER BY checked_at`;
  return result.rows;
});
```

That's a direct primitive call — no LLM, no cost, just the tagged-template `db` interface against the agent's own SQLite.

## Alert logic you can read in one breath

The threshold rule lives in the identity, in English:

> "A price move matters when the absolute percent change from the most recent recorded price meets or exceeds that product threshold_pct. The first observation for a product never matters - there is nothing to compare against."

And the output contract is strict enough to pipe into Slack:

> "Answer with one line per flagged move formatted as ALERT <name>: <old> -> <new> (<signed percent>), or the single line all quiet - N products checked."

No fuzzy prose. A downstream webhook can `grep '^ALERT'` and be done.

## Tomorrow is booked by today

Every `check` ends with the same move the cookbook's [`daily-digest`](../daily-digest/agent.js) uses: "call schedule with in set to 1 day and note set to check." The wake intent lands in the runtime's park ledger; the run exits; tomorrow a fresh run starts with `check` as its prompt. There's a belt-and-braces cron registration too:

```js
agent.schedule("daily-price-check", "daily", runCheck, { maxCost: 0.2 });
```

Note the numbers: each check pass is capped at 20 steps and $0.20, the `track` task at 6 steps and $0.05, and the identity budget caps the whole agent at `perDayCents: 100`. On haiku, a day of watching a dozen products lands well under a dime.

`fetch_price` is the single stub — the sandbox has no network of its own, so the custom tool is your window to the world. Point its `run` body at a scraping API or an internal price feed; the schema the model sees stays identical.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy price-monitor
```

Track a product and kick off the first check:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/price-monitor/track \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Pro plan", "url": "https://acme.example/pricing", "threshold_pct": 5}'

curl -X POST https://api.oncell.ai/api/v1/agents/price-monitor/check -d '{}'
```

Day one answers `all quiet - 1 products checked` (first observation, nothing to compare). The day Acme moves 7%, you get `ALERT Acme Pro plan: 49 -> 52.5 (+7.1%)` — and a `history` curl shows you exactly when.

## What you didn't have to build

A cron service and its box. A database with a migration for the price table. Threshold config storage. A "first run" special case scattered through alerting code. Cost alarms for a scraper loop gone wild — the step cap, the per-run cost cap, and the daily budget are all enforced by the runtime.

You wrote two table schemas and a definition of "matters." The watcher never blinks, and it never costs more than a dollar a day.
