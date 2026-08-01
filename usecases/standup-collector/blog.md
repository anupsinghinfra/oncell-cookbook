---
title: The Standup Bot that Chases People So You Don't Have To
description: An agent that pings each teammate, compiles one tidy standup, posts it, files it with another agent — and schedules its own tomorrow.
date: 2026-08-01
slug: standup-collector
---

# The Standup Bot that Chases People So You Don't Have To

The async standup has a universal failure mode, and it isn't the format. Someone posts the thread at 9am. Three people reply. Two reply at 4pm in a different channel. One never replies, and nobody notices until Thursday, when it turns out they were blocked all week. The "bot" that was supposed to fix this is usually a webhook that posts a template and then does absolutely nothing else — because the hard part of standups is not the posting. It's the chasing, the remembering who replied, and the doing it again tomorrow.

Chasing is a stateful, time-driven job. You need somewhere durable to keep the roster and today's replies. You need a timer that fires "compile the summary in two hours" and another that fires "start again tomorrow" — timers that survive deploys and dead hosts. That's a database, a scheduler, and a worker before you've written a single sentence of standup logic.

`standup-collector` is one file, because all three of those are runtime primitives.

## Two wake intents per day, zero cron

The identity instructions in [`agent.js`](agent.js) end the `collect` procedure like this:

> "Then call schedule twice: once with in set to 2 hours and note set to compile, once with in set to 1 day and note set to collect."

Each `schedule` call records a durable wake intent in the runtime's park ledger. The run then exits normally — no process waits around. Two hours later the runtime starts a fresh run with `compile` as its prompt; tomorrow it starts another with `collect`. Redeploy the agent in between, lose the host, it doesn't matter: the intents belong to the runtime, not the process. The identity tells the agent how to interpret those wakes — "A note reading collect means run the collect task" — so the chain is self-describing and self-sustaining.

The state layer is two memory shapes, declared right in the identity: a `roster` key holding `{ name, handle }` entries, and one `update:<YYYY-MM-DD>:<name>` key per submitted update. Durable KV, no schema, no migration, survives everything.

## An agent that talks to another agent

The `compile` procedure has the line that makes this a cookbook recipe rather than a toy:

> "...then invoke the daily-digest agent task add-note with text set to a one-line summary of the standup; if that invoke fails, skip it without complaint."

That's the `agents` capability — declared in one line:

```js
capabilities: [tools.memory, tools.schedule, tools.agents, sendMessage],
```

If you've deployed [`daily-digest`](../daily-digest/agent.js) from this cookbook, your standup now automatically feeds your morning briefing. Two agents you deployed separately compose into a pipeline, with no message bus, no shared database, and graceful degradation written as one clause of English.

`send_message` is the only stub in the file — a custom tool whose `run` body you point at Slack or Teams. It's declared exactly like a prebuilt tool (`params` is the JSON schema the model sees) and lives in source only; the manifest never carries it.

## Cheap where it can be

The pings and the submissions don't need deep thinking, so their loops are tight:

```js
const result = await agent.llm("Task: submit " + JSON.stringify({ name, update }), {
  maxSteps: 6,
  maxCost: 0.15,
});
```

The compile pass gets more room (`maxSteps: 16, maxCost: 0.5`), and the identity budget caps the whole agent at `perDayCents: 200` — two dollars a day, enforced by the runtime's metering, not by hope. There's also a belt-and-braces cron registration (`agent.schedule("daily-collect", "daily", ...)`) so the habit starts even before the first self-scheduled wake exists.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy standup-collector
```

Add your team, then kick off the first cycle:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/standup-collector/add-member \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "dana", "handle": "@dana"}'

curl -X POST https://api.oncell.ai/api/v1/agents/standup-collector/collect -d '{}'
```

Teammates reply via `submit` (wire your messenger's slash command at it), and two hours later the compiled standup — Done, Doing, Blocked, plus who ghosted — lands in the channel.

## What you didn't have to build

A cron service and the box it runs on. A store for the roster and today's replies. Retry logic for the compile job. A "who hasn't answered" tracker. An integration bus between your standup tool and your digest tool. The runtime supplied durable time, durable memory, agent-to-agent calls, and a hard daily spend cap.

You wrote a roster shape and two procedures in English. One command deploys the whole ritual.
