---
title: The Morning Digest that Schedules Its Own Tomorrow
description: A daily briefing agent with no cron box, no queue, and no worker — durable time is a runtime primitive on OnCell.
date: 2026-08-01
slug: daily-digest
---

# The Morning Digest that Schedules Its Own Tomorrow

Every team accumulates a slow leak of small updates: a note in Slack, a decision in a thread, a follow-up someone promised in standup. The fix everyone attempts is a daily digest. The way it dies is always the same — not the summarization, which any model handles, but the *every morning* part.

"Every morning" means a cron box someone has to keep alive. A queue for when the box was down at 7am. A retry policy. A database for the notes, a bucket for the digests, and a runbook for the Tuesday everything double-fired after a deploy. The digest itself was twenty minutes of work; the *time infrastructure* around it is why yours stopped arriving in March.

`daily-digest` deletes that entire layer. It's an agent that compiles the briefing — and then schedules its own tomorrow, as a durable intent the runtime owns.

## Time as a capability

Look at the capability list in [`agent.js`](agent.js):

```js
capabilities: [tools.memory, tools.db, tools.files, tools.schedule],
```

`db` holds the notes log, `files` holds the digests, `memory` holds the watermark — and `schedule` is the interesting one. It gives the agent a tool that records a *wake intent* in the runtime's park ledger. The identity instructions end the digest procedure with it:

> "…set last_digest_at to now, then call schedule with in set to 1 day and note set to digest - that one call is what makes you a daily habit instead of a one-off script."

When the agent calls `schedule`, the runtime writes a durable ledger entry with a wake time and starts a timer. The run then finishes normally. Tomorrow, the runtime wakes the agent with that note as a fresh task — even if the host was replaced overnight, even if you redeployed the agent twice in between. The agent expresses intent; the runtime owns time. Each digest ends by scheduling the next, so the chain sustains itself forever — and if you ever want it to stop, you stop it in the dashboard, not by SSHing into a cron box.

The SDK's cron surface is also registered as a belt-and-braces trigger:

```js
agent.schedule("morning-digest", "daily", runDigest, { maxCost: 0.5 });
```

Note the `maxCost` — a per-run spending cap on top of the identity's `perDayCents: 200`. A scheduled agent that can never exceed $2/day is an agent you can forget about safely, which is the entire value proposition of a digest.

## State without a stack

The notes live in a real SQLite table — `notes(id, text, created_at)` — that the agent creates on first touch. The digests are markdown files under `digests/`, one per day. The watermark (`last_digest_at`) is one memory key. Three kinds of durable state, zero provisioning: no RDS, no S3 client, no migrations. Each is NVMe-fast locally and synced to S3 by the runtime.

The `latest` task shows the other side of the SDK — primitives without a model in the loop:

```js
agent.task("latest", async () => {
  const names = await agent.files.list("digests");
  ...
  return await agent.files.read(path);
});
```

Reading yesterday's digest costs zero tokens. You reach for `agent.llm` when there's judgment involved and plain primitives when there isn't — both cross the same supervisor boundary, both land in the same run log.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy daily-digest
```

Feed it during the day:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/daily-digest/add-note \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "Shipped the new checkout flow to 10% of users"}'
```

Kick off the habit once — `curl -X POST .../daily-digest/digest -d '{}'` — and it writes today's briefing with Highlights, Decisions, and Follow-ups, then quietly books tomorrow's run. On a quiet day it still writes the file ("quiet day"), still schedules tomorrow. Habits don't skip days; that's what makes them habits.

## What you didn't have to build

A cron host. A job queue with retries and a dead-letter corner. A database and a bucket and the glue between them. Idempotency guards for double-fires. Monitoring for the scheduler itself. Per-run and per-day cost controls.

You wrote a briefing procedure and the sentence "schedule tomorrow." The runtime does mornings now.
