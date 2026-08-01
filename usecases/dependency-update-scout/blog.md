---
title: The Dependency Scout that Reviews Your Stack Every Monday
description: The steady-cadence pattern on OnCell — a weekly self-rebooking chain that sweeps your deps against the registry and writes a risk-ordered upgrade note.
date: 2026-08-01
slug: dependency-update-scout
---

# The Dependency Scout that Reviews Your Stack Every Monday

Dependency hygiene is the chore everyone agrees matters and nobody does on time. Dependabot opens forty PRs and trains you to ignore them. The quarterly "upgrade sprint" discovers you are three majors behind on something load-bearing. The middle path — a short weekly review, ordered by risk, written by someone who actually read the changelogs — is exactly the kind of recurring judgment work that never survives contact with a sprint board.

`dependency-update-scout` is that middle path as an agent. Once a week it looks up every dependency you track, sorts what is behind into *breaking-change candidates* and *routine bumps*, and writes a dated note under `notes/` that a busy engineer can act on in ten minutes.

## The steady cadence, in one sentence

This agent demonstrates the **steady cadence** — the simplest scheduling pattern in the collection, and the foundation the fancier ones build on. There is no cron expression anywhere. The identity's wake procedure just ends with:

> "...then call schedule with in set to 7 days and note set to review."

That single sentence is the whole scheduler. When the pass finishes, OnCell's `schedule` tool records a durable wake intent — a ledger entry with a wake time, owned by the runtime. Seven days later the runtime starts a *fresh run* with the note `review` as its prompt, the identity tells the agent what a `review` note means, and the last step of that pass books the next. The chain is the schedule.

What makes this better than cron is what it survives. A cron entry lives on a host; when the host dies, so does your Monday review, silently. A wake intent lives in the runtime's park ledger: the agent has no process between passes (it costs $0 for six days and twenty-three hours a week), and the wake fires even if the agent was redeployed twice in between.

## Zero tokens until there is judgment

Look at where the model is and is not in the loop in [`agent.js`](agent.js). The ingest path is pure primitives:

```js
agent.task("set-deps", async (args) => {
  ...
  await agent.db.sql`INSERT INTO deps (name, current) VALUES (${dep.name.trim()}, ${dep.version})
    ON CONFLICT(name) DO UPDATE SET current = ${dep.version}`;
```

Pasting your two hundred dependencies in is two hundred SQLite upserts and zero tokens. Reading the latest note back (`latest-note`) is a file read, also zero. The LLM runs exactly once a week, inside `start`/`review`, capped at `maxSteps: 24, maxCost: 0.5` — and even that lives under a `perDayCents: 75` identity ceiling. The judgment is worth paying for: `registry_lookup` (a stub — wire it to npm, PyPI, or crates.io) returns the latest version and a change summary, and the model decides what is a risk and what is routine, then writes prose about it.

## Starting and stopping a chain

A self-rebooking chain needs an explicit on-switch and off-switch, and this repo has a convention for both. `start` clears the stop flag and runs one pass — which books the next, arming the cadence. `stop` is zero-LLM:

```js
await agent.memory.set("scout_stopped", true);
```

The pending wake is not cancelled — it fires, reads `scout_stopped`, and stands down in one line. Coordination through state: you never hunt down scheduled work; you change what it will find when it wakes. Note that the smoke task is `set-deps`, not `start` — ingest never arms an infinite chain. Arming is a decision you make once, on purpose.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy dependency-update-scout
```

Load your list (zero tokens), then arm it:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/dependency-update-scout/set-deps \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"deps": [{"name": "react", "version": "18.3.1"}, {"name": "zod", "version": "3.23.8"}]}'

curl -X POST https://api.oncell.ai/api/v1/agents/dependency-update-scout/start -d '{}'
```

Every week after that: one pass, one note, one line of output — `212 tracked, 9 behind, note written`.

## What you didn't have to build

A cron host and its monitoring. A worker that stays resident all week to do one hour of work. Storage for the dep list and the notes. A kill switch that races the scheduler. Cost ceilings.

You wrote a review procedure and the sentence "schedule 7 days out." Monday belongs to the runtime now.
