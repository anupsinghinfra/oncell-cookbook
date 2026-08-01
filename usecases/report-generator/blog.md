---
title: The Monday Report Nobody Had to Remember to Write
description: Zero-token metric ingestion into SQLite all week, one LLM pass every Monday, a durable archive of markdown reports — and the next Monday books itself.
date: 2026-08-01
slug: report-generator
---

# The Monday Report Nobody Had to Remember to Write

Every team has a metrics report that used to exist. It was born in a burst of discipline — someone pulled numbers each Monday, compared them to last week, wrote three honest bullets about what moved. It died the week that someone was on vacation. Not because the numbers stopped mattering, but because the report was a *ritual* attached to a *person*, and rituals attached to persons have a half-life measured in months.

The obvious automation — a dashboard — solves a different problem. Dashboards answer questions you ask; reports tell you things you didn't ask. "Signups down 14% week-over-week" only reaches you if something *compiles the comparison and pushes it*. And the compile-and-push machine is the annoying part: somewhere to accumulate numbers, a scheduled job, templating, an archive. For a weekly report, nobody builds it twice.

`report-generator` is that machine as a single file, with a design split worth copying: ingestion never touches the model, and the model runs once a week.

## Writes are free

Look at what the `record` task doesn't do in [`agent.js`](agent.js):

```js
agent.task("record", async (args) => {
  const metric = typeof args.metric === "string" ? args.metric.trim() : "";
  const value = Number(args.value);
  if (metric.length === 0 || !Number.isFinite(value)) {
    throw new Error("record requires { metric, value }");
  }
  await agent.db.sql([METRICS_TABLE]);
  const now = new Date().toISOString();
  await agent.db.sql`INSERT INTO metrics (metric, value, recorded_at) VALUES (${metric}, ${value}, ${now})`;
  return { recorded: true, metric, value };
});
```

No `agent.llm` anywhere. Validation at the boundary, one tagged-template insert into the agent's SQLite, done — microseconds, zero tokens. Fire it from CI, from cron jobs, from application code, a thousand times a day; ingestion cost stays at zero. The agent's identity even formalizes the split: "Rows are inserted by the record task without you; treat the table as read-only input." The model is an analyst, not a clerk.

## One judgment pass per week

Monday's `report` task is the single LLM loop, and the identity pins its output to a fixed shape: Summary (three bullets max), Movers (every metric that shifted ≥10% week-over-week, one parseable line each), Full table. Comparisons are defined precisely — summed values per metric per week, prior 7 days vs. the 7 before — and edge cases are pre-decided: no prior data means `new`, an empty table still produces a report ("no data yet") because a report that silently skips weeks is a report you stop trusting.

The pass is capped at `{ maxSteps: 16, maxCost: 0.5 }`, the agent at `perDayCents: 100`. A dollar a day is roughly 14× more than this agent will ever use — the ceiling exists so you never have to think about it.

And the last step of every report is the cookbook's signature move: "call schedule with in set to 7 days and note set to report." The ritual detaches from the person and attaches to the runtime's park ledger, where vacations don't exist. A `agent.schedule("weekly-report", "weekly", ...)` registration bootstraps the first cycle.

## The archive reads for free

Reports land in `reports/YYYY-MM-DD.md` on the durable filesystem, and `latest` returns the newest one with zero tokens — pipe it straight into Slack:

```js
const newest = [...names].sort().at(-1);
...
return await agent.files.read(path);
```

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy report-generator
```

Instrument anything that can curl:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/report-generator/record \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"metric": "signups", "value": 42}'
```

Kick the first report with `curl .../report -d '{}'`, then let Mondays happen. `curl .../latest -d '{}'` fetches the current report any time, free.

## What you didn't have to build

A metrics store and its migration. An ingestion API with its own service. A scheduled job runner that survives deploys. Report templating. An archive bucket. The discipline of a person who never takes vacations — that part especially.

You wrote a table schema and a report format. Ingestion is free, judgment is weekly, and Monday takes care of itself.
