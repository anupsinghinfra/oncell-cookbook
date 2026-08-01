---
title: Plan Weekly, Remind Daily — the Content Calendar Split
description: The planner/executor split on OnCell — an expensive weekly wake writes the plan file, a cheap daily wake only reads it, and the artifact is the contract between them.
date: 2026-08-01
slug: content-calendar-planner
---

# Plan Weekly, Remind Daily — the Content Calendar Split

Consistent publishing has two failure modes, and they take turns killing you. Plan nothing, and every morning starts with the paralyzing question *what should I even write today?* Plan constantly, and you spend your writing energy re-planning — shuffling the Notion board instead of shipping the Tuesday post. The teams that actually publish figured out the rhythm long ago: decide the week once, then execute without renegotiating with yourself daily.

`content-calendar-planner` encodes that rhythm as two scheduled chains with a strict division of labor. This is the **planner/executor split**: an expensive weekly wake that *thinks*, a cheap daily wake that only *reads*, and a plan file as the contract between them.

## Two wakes, two verbs

The identity in [`agent.js`](agent.js) defines one procedure per wake note. The weekly `plan` wake does the real work — pull the idea backlog from SQLite, choose at most five, vary the formats, prefer old ideas so nothing rots, write `plans/2026-W32.md` with a Mon-Fri slot each, re-book in 7 days. The daily `remind` wake is deliberately dumb:

> "...open the current week's plan file, find today's slot, and send one send_reminder naming the topic, format, and angle... Never write or edit a plan on a remind wake - reading the plan is the whole job."

That last sentence is the pattern's load-bearing wall. The moment the daily wake is allowed to "improve" the plan, you've rebuilt the re-planning treadmill with extra tokens. Here the split is enforced in the identity itself: planning happens once, at the boundary; execution consults the artifact. The plan file isn't a log of what the agent decided — it *is* the interface between the two chains, and it's equally readable by you (`current-plan` returns it as a zero-token file read).

The economics follow the split. The weekly wake runs a real thinking pass (`start` caps at `maxCost: 0.6`); the daily wake opens one file and sends one message — a few cents. Both chains fit under a `perDayCents: 150` ceiling, and six days out of seven the agent spends almost nothing.

## The backlog costs nothing to feed

Ideas are captured the moment they happen, with no model in the loop:

```js
agent.task("add-idea", async (args) => {
  ...
  await agent.db.sql`INSERT INTO ideas (topic, status, added_at) VALUES (${topic}, 'backlog', ...)`;
```

Zero tokens per idea — wire it to a Slack shortcut or an iOS share sheet and capture at the speed of thought. The planner reads `status = 'backlog'`, marks its picks `planned`, and honors an honesty rule worth copying: "Fewer than 5 ideas in the backlog means a lighter week — never pad with invented topics." A planner that invents filler to fill slots is a planner you stop trusting by week three.

## One start, one stop, two chains

`start` arms both clocks in a single run — it executes one planning pass (which books next week's `plan`) and schedules tomorrow's `remind`. From then on each chain re-books only itself, interleaved through the same agent: seven cheap wakes and one expensive one per week.

`stop` is the repo's standard kill switch — a zero-LLM memory write (`planner_stopped = true`) that both pending wakes read and obey when they fire. Nothing is cancelled; the chains stand down through state and `start` re-arms them by clearing one key. And the smoke task is `add-idea`, per the collection-wide rule: dropping an idea in the backlog must never arm an infinite chain.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy content-calendar-planner
```

Fill the backlog (zero tokens, any time):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/content-calendar-planner/add-idea \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topic": "Why we moved our scheduler into the runtime"}'
```

Arm it once — `curl -X POST .../start -d '{}'` — and Sunday's run picks the week. Each weekday morning one nudge arrives: today's topic, the format, a two-line angle. No slot today? Silence, and the chain books tomorrow anyway.

## What you didn't have to build

A cron pair whose schedules must not drift apart. A backlog database and capture API. A worker resident all week to think for one hour. Guard rails keeping the daily job from mutating the weekly decision. Cost separation between thinking and reminding.

You wrote a planning judgment and a reading rule. The runtime keeps both clocks; the plan file keeps the peace between them.
