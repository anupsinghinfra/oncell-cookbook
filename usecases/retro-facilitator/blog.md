---
title: The Retro that Runs Itself in Three Acts
description: The multi-phase cycle pattern on OnCell — one biweekly retro spread across open, remind, and close wakes, each phase booking the next.
date: 2026-08-01
slug: retro-facilitator
---

# The Retro that Runs Itself in Three Acts

Retrospectives are the ritual everyone defends in principle and skips in practice. The meeting version costs six people an hour and rewards whoever thinks fastest out loud. The async version — "drop thoughts in the doc by Friday!" — dies quieter: no opening bell, no nudge when the doc sits empty on Wednesday, and no one on the hook to synthesize, so the doc becomes a graveyard of half-thoughts nobody reads back.

Notice what actually failed there. Not the writing, not the honesty — the *choreography*. A working retro is three timed moments: an opening bell, a mid-window nudge, and a closing synthesis. Miss any one and the ritual decays.

`retro-facilitator` is that choreography as an agent, and it demonstrates the **multi-phase cycle** pattern: one logical event spread across several phased wakes, each phase booking the next. Where a steady-cadence agent's wake re-books *itself* (`review` → `review`), this agent's chain is a loop through distinct states:

> open → (4 days) → remind → (3 days) → close → (7 days) → open → ...

Each wake note names a phase, each phase's procedure in [`agent.js`](agent.js) ends by scheduling the *next* note, and the `close` phase booking the next cycle's `open` is what makes it a ritual instead of a one-off. The chain is a state machine whose transitions are wake notes — no workflow engine, no step-function DSL, just three paragraphs of identity prose and three `schedule` calls.

## The phases, briefly

**Open** (day 0) sets `window_state` to open and posts the announcement via `post_message` (a stub — wire it to Slack). **Remind** (day 4) counts this cycle's entries and nudges with the number and days left — the nudge that the empty Wednesday doc never got. **Close** (day 7) flips the window closed, synthesizes, posts the themes, increments `current_cycle`, and books the next open seven days out — a 14-day rhythm end to end.

The synthesis rules are where the agent earns trust: 2-4 named themes, at most one verbatim quote per theme, a Keep/Change/Try section — and "Attribute nothing to a person in the summary." Anonymized synthesis is precisely why people write honest entries. An empty cycle gets a short honest file, and the cycle books the next open anyway; rituals survive quiet weeks by not skipping them.

## The window is state, and state is free

Teammates submit through a zero-LLM task, and the collection window is enforced without a model in the loop:

```js
const state = await agent.memory.get("window_state");
if (state === "closed") return "The window for this cycle is closed - ...";
const cycle = (await agent.memory.get("current_cycle")) ?? 1;
await agent.db.sql`INSERT INTO entries (author, text, cycle, created_at) VALUES (...)`;
```

Every entry costs zero tokens, lands stamped with the current cycle, and bounces politely when the window is shut. The model runs three times per fortnight — two one-liners and one real synthesis — under `maxCost: 0.3` per wake and a lean `perDayCents: 75` ceiling.

Stopping follows the repo convention: `stop` is one zero-LLM memory write (`retro_stopped = true`), and *whichever phase wake fires next* reads it and stands down — you never need to know which phase is pending. `start` clears the flag and runs an `open`, re-arming the cycle. The smoke task is `add-entry`, because submitting a thought must never boot an infinite ritual.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy retro-facilitator
```

Team members submit whenever the mood strikes:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/retro-facilitator/add-entry \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"author": "sam", "text": "The deploy freeze on Friday saved us; let us keep it"}'
```

Arm the ritual once — `curl -X POST .../start -d '{}'` — and the channel gets its opening bell. `latest-retro` returns the newest synthesis as a zero-token file read.

## What you didn't have to build

A workflow engine for a three-step sequence. Three cron entries that must stay phase-locked through deploys. Window enforcement middleware. A facilitator role that rotates onto whoever forgets. The synthesis discipline itself — themes, quotes, no names — which is the part meetings never deliver.

You wrote three phase procedures and their hand-offs. The runtime keeps the ritual's clock, and the ritual keeps itself.
