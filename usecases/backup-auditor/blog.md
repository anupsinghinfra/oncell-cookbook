---
title: The Backup Auditor that Doesn't Trust Green Checkmarks
description: Cadence with a human gate on OnCell — a daily automated verify chain plus a monthly restore drill that parks on ask_human at zero cost.
date: 2026-08-01
slug: backup-auditor
---

# The Backup Auditor that Doesn't Trust Green Checkmarks

There are two kinds of teams: teams that have tested a restore, and teams that have backups. The nightly job says green. The dashboard says green. Then the day comes, and the "backup" is 4 KB of error message, or the right data encrypted with a key nobody rotated into the vault, and the greenness of the last 400 checkmarks is revealed as a rumor everyone chose to believe.

The industry answer is the restore drill — actually restore a backup, monthly, on a rotation. Everyone agrees. Nobody does it, because a drill needs a human, and recurring work that needs a human is exactly what calendars and cron are both bad at. Cron can't wait for a person; a calendar invite can't check whether last night's backup ran.

`backup-auditor` does both, and the combination is the pattern: **cadence with a human gate**. Two chains at two speeds — a fast loop that is fully automated, and a slow loop that deliberately is not.

## The fast loop: daily, mechanical, haiku

The daily `verify` wake is pure machinery. From the identity in [`agent.js`](agent.js):

> "A job fails verification when ok is false, or completed_at is older than 26 hours, or size_mb dropped more than 50 percent below last_size_mb."

The wake runs `check_backup` (a stub — wire it to pgBackRest, restic, AWS Backup) for every job, applies that rule, writes freshness back to the `jobs` table, and re-books itself: `schedule` with `in` = 1 day, note `verify`. Note the model choice: `claude-haiku`, with a `perDayCents: 50` ceiling and `maxCost: 0.2` per pass. A check this mechanical, running this often, should cost pennies — the repo's convention for uptime-style loops.

## The slow loop: monthly, and it parks

The `drill` wake is where the agent stops trusting tools. It picks the job with the oldest `last_drill` and then does the thing cron cannot:

> "...call ask_human with a question naming that job and asking the operator to restore its latest backup to a scratch environment and reply with what they found."

The run parks. Not "polls until timeout" — parks: the run is suspended into the ledger at $0, for an hour or a week, until a human answers. No compute burns while your ops engineer schedules the scratch restore for Thursday. When the answer lands, the same run resumes, records `last_drill` and a one-line `drill_result` in the ledger, and books next month's drill.

Meanwhile — and this is the point of two chains — the daily verify keeps firing underneath. A parked drill blocks nothing. The fast loop and the slow loop share a table but not a fate.

## One switch for both chains

`start` arms everything in one call: it runs a verify pass (which books tomorrow) and schedules the first `drill` 30 days out. `stop` is a zero-LLM memory write — `auditor_stopped = true` — and both chains' next wakes read it and stand down. Coordination through state, not cancellation: there is no pending-job list to hunt through, and clearing one flag re-arms the world.

The ingest path never touches the model at all. `add-job` is an `INSERT OR IGNORE`; `status` is a `SELECT`. Registering your whole backup fleet costs zero tokens — and deliberately does not start any chain. The smoke task is `add-job` for exactly that reason: arming an infinite loop should never happen as a side effect.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy backup-auditor
```

Register jobs (zero tokens), then arm:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/backup-auditor/add-job \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"job": "prod-postgres-nightly"}'

curl -X POST .../backup-auditor/start -d '{}'
```

Every morning: one line per job, failures named loudly. Once a month: a question lands in front of a human that no dashboard can answer for them — *restore it and tell me what you found* — and the answer goes on permanent record in `drill_result`.

## What you didn't have to build

A cron box for the daily check. A separate reminder system for the drill rotation, and the spreadsheet tracking who drilled what. A way for automation to wait a week for a person without a worker burning the whole time. Records tying each drill to its outcome. Cost caps.

You wrote a failure rule and a question. The runtime runs the checks, keeps the calendar, and holds the question open until a human earns the checkmark.
