---
title: Churn Doesn't Announce Itself — Score It Weekly, on a Rubric CS Can Read
description: Free event ingestion into SQLite, a churn rubric packaged as a diffable skill, and a weekly scoring pass that books its own next week.
date: 2026-08-01
slug: churn-detector
---

# Churn Doesn't Announce Itself — Score It Weekly, on a Rubric CS Can Read

No account churns on the day it churns. The cancellation email is the *last* event in a sequence that started six weeks earlier: logins thinning out, a seat quietly removed, a billing failure nobody chased, the last export a month ago. Customer success teams know this — and still find out at cancellation, because the signals live in an analytics tool nobody opens with that question, and the one dashboard that could answer it got built for a QBR and never refreshed.

The enterprise fix is a churn-prediction model: a data science quarter, a feature store, and a score nobody trusts because nobody can explain it. The pragmatic fix — the one that actually changes renewal numbers — is embarrassingly simpler: a *rubric*. Points for silence, points for shrinkage, points for friction. Run it every week. Name the reasons. The only hard part is that someone has to run it every week, forever, and aggregate the events somewhere first.

`churn-detector` is that rubric with the "someone" removed.

## The firehose is free

Events arrive through a task with no model in it, in [`agent.js`](agent.js):

```js
agent.task("event", async (args) => {
  ...
  await agent.db.sql([EVENTS_TABLE]);
  const now = new Date().toISOString();
  await agent.db.sql`INSERT INTO events (account, type, at) VALUES (${account}, ${type}, ${now})`;
  return { recorded: true, account, type };
});
```

Validate, insert, return — zero tokens at any volume. Point a segment of your analytics pipeline at it (`login`, `feature_use`, `invite`, `export`, `support_ticket`, `billing_failure`, `seat_removed`) and the evidence accumulates in the agent's own SQLite all week for nothing. The identity draws the division of labor exactly: "Rows are inserted by the event task without you; treat the table as read-only input."

## A scoring model your CS lead can diff

The rubric is a skill — four weighted signals, in plain sight:

> "Silence (0-40): 40 if no login in 14 or more days... Shrinkage (0-30): 15 per seat_removed event... Friction (0-20): 10 per billing_failure; 5 per support_ticket... Disengagement (0-10): 10 if there are zero feature_use, invite, and export events..."

Bands at 40 and 70 split healthy / watch / at-risk. When CS decides billing failures deserve more weight, that's a one-line skill edit and a redeploy — the scoring model has a git history instead of a data science backlog. And the rubric bans the failure mode that kills trust in churn scores:

> "Reasons: name the top contributing signals concretely, like no login in 19 days or 2 billing failures - never vague phrases like low engagement."

A CSM can act on "no login in 19 days." Nobody can act on a 0.73.

Score history is append-only by contract — "append one scores row per account per scoring pass - never overwrite history" — so you can chart any account's risk trajectory over months straight out of the `scores` table.

## Weekly, forever, unattended

The `score` pass ends with the cookbook's self-scheduling move — "call schedule with in set to 7 days and note set to score" — a durable wake intent that survives deploys and dead hosts, bootstrapped by `agent.schedule("weekly-churn-score", "weekly", ...)`. Each pass is capped at `{ maxSteps: 20, maxCost: 0.6 }` under a $2/day ceiling; `risky {}` re-reads the latest pass cheaply without re-scoring anything.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy churn-detector
```

Stream events, then ask the weekly question:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/churn-detector/event \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"account": "acme", "type": "billing_failure"}'

curl -X POST https://api.oncell.ai/api/v1/agents/churn-detector/score -d '{}'
```

The answer reads like a CS standup, not a model output: `acme: 75 (at-risk) - no login in 16 days` — ordered by score, one line per account, or `all healthy - 23 accounts scored` on a good week. Pipe it into the CS channel and Monday's renewal conversation starts with the right three names.

## What you didn't have to build

An events pipeline with its own service and storage. A feature store and a model nobody can explain. A weekly job runner that outlives vacations and deploys. Score-history retention. The runtime keeps ingestion free, the pass cheap, the cadence durable, and the whole thing under $2/day.

You wrote four signals and two thresholds. The accounts drifting toward the exit now get named six weeks before the cancellation email — which is exactly when naming them still matters.
