---
title: The Handoff Doc that Writes Itself When the Pager Changes Hands
description: The report-at-boundary pattern on OnCell — free continuous incident ingest all week, one judgment pass at the rotation turn.
date: 2026-08-01
slug: oncall-handoff-writer
---

# The Handoff Doc that Writes Itself When the Pager Changes Hands

Every on-call rotation has the same Monday ritual: the outgoing engineer, finally free, writes "quiet week, nothing major 👍" in Slack — over an unresolved sev2, a flapping alert they silenced Thursday, and a mitigation that's actually a time bomb. Not out of malice; out of exhaustion. The moment you're asked to summarize the week is the exact moment you most want to stop thinking about it.

The handoff doc is real work at the worst possible time, done by the least motivated person in the building. Which makes it a perfect agent job — because the raw material was all machine-readable as it happened, and only the compression needs judgment.

`oncall-handoff-writer` demonstrates the **report-at-boundary** pattern: continuous, free ingest inside a period; one scheduled judgment pass exactly at the period's edge. The wake isn't monitoring anything and doesn't fire on events — it's aligned to an *organizational* boundary, the rotation turn, and its entire job is to compress what accumulated into an artifact for whoever owns the next period.

## The week logs itself

All week, incidents land through a zero-LLM task in [`agent.js`](agent.js):

```js
await agent.db.sql`INSERT INTO incidents (severity, title, summary, resolved, occurred_at)
  VALUES (${severity}, ${title}, ${summary}, ${resolved}, ${new Date().toISOString()})`;
```

Wire your pager's resolve-hook to `log-incident` and the log builds itself — zero tokens per entry, whether the week brings three incidents or forty. `resolve` is the same shape: one free `UPDATE` when something closes. No model touches any of it, because none of it is judgment yet.

## Compression at the edge

When the `handoff` wake fires, the identity prescribes a doc with a deliberate order — and the first section is the whole reason this agent exists:

> "Still open (every unresolved incident, oldest first - this is the section the next on-call actually needs)..."

Then the week in one-liners, then "Patterns worth knowing" with an honesty constraint worth copying into every reporting agent — "never invent a pattern from one data point" — then the numbers. The watermark (`last_handoff_at`, one memory key) defines the period: everything after it, *plus every still-open incident from before it*. Unresolved work re-surfaces in every handoff until someone closes it. Nothing rots silently between rotations.

And a quiet week still writes a doc, because the identity encodes the operational truth every on-call knows: "a silent handoff and a missing handoff look identical to the next on-call, so never skip."

The pass ends with `schedule` — `in` 7 days, note `handoff` — the standard self-rebooking chain. The agent exists for one writing pass a week (`maxCost: 0.5`, under a `perDayCents: 75` ceiling) and is a $0 ledger entry the other six days. `stop` is the repo's zero-LLM stand-down flag; `start` clears it and runs a pass, arming the chain. The smoke task is `log-incident` — logging must never arm the chain as a side effect.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy oncall-handoff-writer
```

Point your pager at it (zero tokens per event):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/oncall-handoff-writer/log-incident \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"severity": "sev2", "title": "API latency spike", "summary": "p99 hit 4s for 20 min; mitigated by rolling back the cache change", "resolved": true}'
```

Arm it once, ideally on rotation day — `curl -X POST .../start -d '{}'` — and every seventh day thereafter the doc is waiting: open items first, oldest first. The incoming engineer reads `latest` (a zero-token file read) with their first coffee instead of archaeology.

## What you didn't have to build

An incident database and its ingest API. A cron box aligned to your rotation calendar. The discipline to make a tired engineer write prose on Monday morning. Carry-forward logic for open incidents. A place the docs live that isn't a Slack scrollback.

You wrote a doc structure and a watermark rule. The week accumulates for free, and the boundary writes the report.
