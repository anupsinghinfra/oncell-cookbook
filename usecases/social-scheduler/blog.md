---
title: One Agent, Two Clocks — the Social Scheduler
description: Interleaved cadences on OnCell — a daily publish chain and a weekly rollup chain dispatched by wake note, running through one agent.
date: 2026-08-01
slug: social-scheduler
---

# One Agent, Two Clocks — the Social Scheduler

Every small team's social presence dies the same death. Someone writes five good posts in a burst of energy, publishes two, and the other three age out in a Notion doc. The tools that fix this — Buffer, Hootsuite — fix it by making you adopt a whole product, and none of them will also *tell you what worked* in a form you'll read.

The actual job has two rhythms. Daily: take the oldest queued post and publish it. Weekly: pull the numbers and write an honest rollup — best performer, worst performer, one observation. Two different clocks, one shared pile of state.

`social-scheduler` runs both clocks in one agent. This is the **interleaved cadences** pattern, and the mechanism that makes it work is almost embarrassingly small: the wake note is a dispatch key.

## A note per rhythm

When an OnCell agent calls the `schedule` tool, the runtime records a durable wake intent and later starts a fresh run *with the note as the prompt*. The note is not metadata — it is the instruction the woken agent reads first. So two chains just means two notes, and the identity in [`agent.js`](agent.js) defines one procedure per note:

> "A note reading publish means: ... take the oldest queued post ... call schedule with in set to 1 day and note set to publish."

> "A note reading rollup means: ... write rollups/YYYY-Www.md ... call schedule with in set to 7 days and note set to rollup."

Each chain re-books only itself. The publish wake never writes rollups; the rollup wake never publishes — the identity says so explicitly, because the discipline is the pattern. Seven publish wakes and one rollup wake fire per week, interleaved through the same agent, sharing the same `posts` table: publish writes `status` and `published_at`, rollup reads them and writes back `likes` and `replies`. State is the interface between the chains.

Why not two agents? Because the state is one thing. The queue the publisher drains is exactly the ledger the analyst reads. Split them and you invent an API between two halves of one job.

## Arming two chains with one call

The `start` task arms both clocks in a single run: it executes one publish pass (which books tomorrow's `publish`) and then books `rollup` seven days out. From then on each chain sustains itself. And one flag stands both down:

```js
agent.task("stop", async () => {
  await agent.memory.set("scheduler_stopped", true);
  ...
```

`stop` is zero-LLM — a memory write. Neither pending wake is cancelled; both fire, read the flag, and stand down in a line. Coordination through state beats cancellation APIs: there is nothing to race, and `start` re-arms everything by clearing one key.

## The queue is free

Notice where tokens are spent. `queue-post` — the task your writers hit all day — is pure primitives:

```js
await agent.db.sql`INSERT INTO posts (platform, text, status, queued_at)
  VALUES (${platform}, ${text}, 'queued', ${new Date().toISOString()})`;
```

Zero LLM. So is `queue`, the read-back. The model runs once a day to publish (a few steps: pick oldest, call `publish_post` — a stub you wire to X or LinkedIn — update the row, re-book) and once a week to think, inside `maxSteps: 16, maxCost: 0.4`, under a `perDayCents: 150` ceiling. The expensive judgment — "what worked this week and why" — is the one place the model earns its keep.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy social-scheduler
```

Fill the queue (zero tokens, any time):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/social-scheduler/queue-post \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"platform": "linkedin", "text": "We just shipped scheduled agents. Thread below."}'
```

Then arm both clocks once: `curl -X POST .../start -d '{}'`. (The smoke task is `queue-post`, deliberately — dropping a post in the queue must never start an infinite chain. Arming is explicit.) An empty queue does not break the chain, either: the publish wake answers "queue empty" and books tomorrow anyway. Habits survive quiet days.

## What you didn't have to build

A cron host running two schedules that must not collide. A queue with worker locks. An analytics fetcher on its own timer. A pause button that has to cancel two kinds of pending jobs. Spend controls.

You wrote two wake procedures and named them. The runtime keeps both clocks wound.
