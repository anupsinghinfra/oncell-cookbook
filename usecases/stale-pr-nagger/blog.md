---
title: The PR Nagger People Don't Mute
description: The fatigue-aware cadence on OnCell — weekday-morning wakes that consult a per-reviewer memory of recent nags before sending anything.
date: 2026-08-01
slug: stale-pr-nagger
---

# The PR Nagger People Don't Mute

Every team has tried the stale-PR bot. Every team has muted it. The lifecycle is fixed: week one, reviews speed up; week two, the channel has a daily wall of `⏰ PR #481 needs review!`; week three, someone filters the bot to a folder, and stale PRs are now *better* hidden than before the bot existed.

The bot didn't fail at scheduling — it fired right on time, every time. It failed at *memory*. It couldn't remember that it already pinged Sam yesterday, and the day before, about the same PR. Reminding is a social act, and a reminder system without a model of the person being reminded converges on spam.

`stale-pr-nagger` demonstrates the **fatigue-aware cadence**: the clock is simple, but the wake consults per-recipient state before it acts. The interesting scheduling isn't *when the agent wakes* — it's *what the wake checks before it's allowed to speak*.

## The clock

One wake per weekday morning, self-booked as an absolute instant — the identity in [`agent.js`](agent.js) carries the weekday arithmetic ("unless tomorrow is Saturday, add two more days...") and ends every pass with `schedule` at the computed next `09:30:00Z`, note `nag`. Friday books Monday; nobody gets pinged into a weekend. The whole loop runs on `claude-haiku` under `perDayCents: 50` and `maxCost: 0.15` per pass — a list-group-and-remind job priced like one.

## The fatigue ledger

Each reviewer has a durable memory key, `nag:<reviewer>` — `{ count, week, last_nagged }` — and the wake applies three skip rules before sending anything: never twice in a day, never more than three times a week (the week counter self-resets when the ISO week rolls over), and never while a snooze is active. Plus one bundling rule that does more for the bot's reputation than any of them: all of a reviewer's stale PRs go in *one* message. Nobody gets a wall.

Tone follows the count: the week's first nag is friendly, the second is a plain list, the third *acknowledges it's the third*. A reminder that knows it's repeating itself reads as a colleague; one that doesn't reads as a cron job — which is what gets you muted.

The `snooze` task is the social contract's other half, and it's zero-LLM:

```js
const until = new Date(Date.now() + days * 86_400_000).toISOString();
await agent.memory.set("snooze:" + reviewer, until);
```

A reviewer going on PTO buys silence with one free call, and the next wakes read the timestamp and skip them — coordination through state, the same mechanism as the collection's stop flags, scoped to one person. `fatigue` exposes the whole ledger as a zero-token read, so "is the bot being annoying?" is answerable with data.

## Start, stop, smoke

The chain follows the repo conventions exactly: `start` clears `nagger_stopped` and runs one pass (which books the next weekday); `stop` is a zero-LLM flag the pending wake reads and obeys. The smoke task is `snooze` — a config write that exercises the fatigue machinery without waking anything, because a health check must never arm an infinite chain.

The stubs are the outside world: `fetch_open_prs` (wire to GitHub or GitLab — a PR is stale after 2 days without activity) and `send_nag` (wire to Slack DMs). Everything else — the ledger, the clock, the restraint — is the agent.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy stale-pr-nagger
```

Arm it once:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/stale-pr-nagger/start -d '{}' \
  -H "Authorization: Bearer $ONCELL_API_KEY" -H "Content-Type: application/json"
```

The morning report reads like a triage sheet, not a siren: `sam: nagged (3 PRs) · priya: skipped (nagged yesterday) · devon: skipped (snoozed until Thu) · all others: all clear`. Sam gets one message listing all three PRs. On Thursday, if two are still stale, message three of the week opens by admitting it's message three — and then the agent goes quiet until Monday resets the counters.

## What you didn't have to build

A weekday cron with holiday hacks. A per-person rate limiter backed by a database. Snooze endpoints and their storage. The bundling logic. The tone ladder. And the thing no bot framework ships: the restraint that keeps your reminder system off everyone's mute list.

You wrote three skip rules and a tone ladder. The runtime keeps the mornings; the memory keeps the peace.
