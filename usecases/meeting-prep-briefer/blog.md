---
title: The Briefer that Knows Friday Books Monday
description: Weekday-only self-rebooking on OnCell — the agent computes its next weekday-morning wake as an absolute `at` instant, so the calendar logic lives in the agent, not in cron syntax.
date: 2026-08-01
slug: meeting-prep-briefer
---

# The Briefer that Knows Friday Books Monday

Walking into a meeting cold is a small, constant tax. The attendee whose name you should know. The agenda you skimmed in the elevator. Executive assistants solve this with a morning briefing document; the rest of us solve it with fifteen frantic minutes of tab-opening before each call.

The automated version has an awkward shape: it should run *every weekday morning*, and "every weekday" is where home-rolled schedulers get ugly. Cron can express `30 6 * * 1-5`, sure — on a box someone maintains, in a syntax someone will misread, with holiday logic bolted on later as a shell script that checks a hardcoded list. The schedule logic and the work logic end up in two different languages on two different machines.

`meeting-prep-briefer` demonstrates the alternative: **weekday-only self-rebooking**. There is no cron expression anywhere. The agent finishes each morning's work by *computing* its own next wake — an absolute ISO instant — and booking it with the `schedule` tool's `at` parameter. The calendar intelligence lives in the agent's identity, in prose:

> "Take today, add one day; if that lands on Saturday add two more, if Sunday add one more. The wake instant is that date at 06:30:00Z."

Friday's run books Monday 06:30. The runtime doesn't know or care that weekends exist — it honors an instant. This is the division of labor OnCell's `schedule` primitive is built around: the agent owns *when-logic*, the runtime owns *time itself* (the durable ledger entry, the timer, the fresh run with the note as prompt). Want to skip company holidays? Add a sentence to the identity. Want 7:00 in your timezone? A sentence. No redeploy of any scheduler infrastructure, because there is none.

## The morning pass

Each `brief` wake in [`agent.js`](agent.js) does three things. It calls `fetch_calendar` (a stub — wire it to Google Calendar or Outlook) for today. It writes `briefs/YYYY-MM-DD.md`: per meeting, what it's for, one line per attendee, and a suggested opening question. And it books the next weekday.

The attendee lines are where the agent's memory earns its place. Humans feed it context over time through a zero-LLM task:

```js
agent.task("add-context", async (args) => {
  ...
  await agent.memory.set("person:" + name, note);
```

`add-context` costs zero tokens — it's one durable KV write. Six months of dropping "Dana cares about integration timelines" style notes in, and the morning brief starts reading like it was written by someone with tenure. A person with no note gets an honest "unknown" — the identity forbids the model to invent biography, which is the difference between a briefer you trust and one you fact-check.

A clear calendar still writes a file ("clear calendar", one line) and still books the next weekday. Chains that skip "boring" days die on them; the wake always re-books.

## Start, stop, and the smoke rule

`start` clears the stop flag and runs one pass, arming the chain. `stop` is a zero-LLM memory write — `briefer_stopped = true` — that the next morning's wake reads before doing anything. The pending wake is never cancelled; it stands down through state, the repo-wide convention for stoppable chains.

And note the smoke task is `add-context`, not `start`. Ingest never arms an infinite chain — booking your first weekday wake is a decision, not a side effect of a health check.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy meeting-prep-briefer
```

Feed it people (zero tokens):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/meeting-prep-briefer/add-context \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Dana Reyes", "note": "CFO at Northwind, cares about integration timelines, met at re:Invent"}'
```

Arm it once — `curl -X POST .../start -d '{}'` — and check `today` (a zero-token file read) with your coffee. The run log tells you the pattern is working in a single line: `3 meetings briefed, next wake 2026-08-03T06:30:00Z` — dated Monday, written on Friday.

## What you didn't have to build

A cron box with `1-5` syntax and a holiday hack. A calendar poller. A people database. Weekend-skip logic in a language other than English. Per-run cost caps (`maxCost: 0.4`, under a dollar-a-day identity budget).

You wrote a briefing format and one paragraph of weekday arithmetic. The agent does mornings; the runtime does time.
