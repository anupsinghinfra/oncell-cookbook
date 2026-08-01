---
title: The CRM Cadence that Reads the Clock, Not a Reminder List
description: Decay scoring at wake on OnCell — one daily wake recomputes relationship decay for the whole network and picks today's three, instead of piling up per-contact reminder jobs.
date: 2026-08-01
slug: crm-touch-cadence
---

# The CRM Cadence that Reads the Clock, Not a Reminder List

Nobody decides to let a relationship go cold. It happens by default: the former manager you meant to congratulate, the customer champion who changed jobs, the investor you only ping when you need something. Sales teams buy CRMs with "cadence" features for this; everyone else sets reminders — *ping Dana in 3 weeks* — and accumulates a graveyard of snoozed notifications, each one a tiny judgment made weeks ago by a person who couldn't see the whole board.

That reminder graveyard is a scheduling architecture, and it's the wrong one. Per-contact timers encode a decision at set-time ("3 weeks feels right") that should be made at wake-time, against everyone else competing for today's attention.

`crm-touch-cadence` inverts it. This is **decay scoring at wake**: the schedule holds exactly one recurring intent — a daily wake — and *zero* per-contact bookkeeping. Each morning the agent recomputes the whole leaderboard from first principles:

> "Decay score = days since last_touch multiplied by importance. An empty last_touch counts as 90 days."

Time does the accumulating on its own; the wake just reads the clock. Nothing is ever booked per person, so nothing per person can go stale, double-fire, or need cancelling when you happen to grab coffee with Dana early. Contrast this with the repo's `cert-expiry-sentinel`, which books precise per-item instants — the right pattern when deadlines are hard. Relationships have no deadlines, only drift, and drift wants a ranking, not an alarm.

## Three people, openers included, or silence

The daily `cadence` wake in [`agent.js`](agent.js) picks the top three eligible contacts with a score of at least 30 and drafts each an opener — "2 or 3 sentences in the voice of a busy friend, grounded in the relationship field," with an explicit ban on inventing shared history. The three go out in one `send_digest` call (a stub — wire it to email or a Slack DM), and `last_suggested` is stamped so nobody gets re-suggested within 7 days. Suggestion fatigue is handled in state, not hope.

Two restraint rules do the most work. The threshold means a well-tended network produces *silence* — "If nobody clears the bar, send nothing" — and a quiet day still re-books tomorrow, because chains that skip boring days die on them. And the model runs once a day under `maxSteps: 16, maxCost: 0.4`, inside a `perDayCents: 100` budget: the only LLM spend is the drafting, which is the only part that needs judgment.

## The free half of the loop

Everything that isn't judgment is zero-LLM primitives. Building the network:

```js
await agent.db.sql`INSERT INTO contacts (name, email, relationship, importance, ...)
  ... ON CONFLICT(name) DO UPDATE ...`;
```

Closing the loop when you actually reach out:

```js
agent.task("touched", async (args) => {
  ...
  await agent.db.sql`UPDATE contacts SET last_touch = ${new Date().toISOString()} WHERE name = ${name}`;
```

`touched` is the habit that makes the whole system honest — one free call and Dana's decay clock resets to zero. `coldest` gives you the live leaderboard as a pure SQL read (the decay formula translated into `julianday` arithmetic), zero tokens, any time.

The chain arms and disarms by the repo convention: `start` clears the `cadence_stopped` flag and runs one pass, which books tomorrow; `stop` is a zero-LLM flag flip that tomorrow's wake reads and obeys. The smoke task is `add-contact` — ingest never starts an infinite chain.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy crm-touch-cadence
```

Load your people (zero tokens):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/crm-touch-cadence/add-contact \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dana Reyes", "email": "dana@northwind.example", "relationship": "former manager, now CFO at Northwind", "importance": 3}'
```

Arm it once — `curl -X POST .../start -d '{}'` — then each morning brings at most three names, each with a why-now and an opener you can send after thirty seconds of editing. Reach out, call `touched`, and watch the leaderboard reshuffle.

## What you didn't have to build

A reminder system and its graveyard of snoozes. Per-contact timer jobs with cancellation logic. A cron host for the morning run. Fatigue tracking. A CRM subscription for what is, underneath, one table, one formula, and one daily wake.

You wrote a decay formula and a taste rule for openers. The runtime does mornings; time does the scoring.
