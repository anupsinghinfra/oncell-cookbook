# Video script — kpi-anomaly-watcher (70s)

## Hook (0-10s)

**Screen:** An inbox: "Daily Metrics Report" ×30, all unread. Cut to a single Slack message: "signups fell to 41 against a baseline of 138 (z = -3.1)".
**VO:** "Thirty daily reports nobody read — or one sentence, on the one day it mattered. The difference is an agent that mostly says nothing."

## The file (10-24s)

**Screen:** `usecases/kpi-anomaly-watcher/agent.js`. Highlight the z-score rule in the identity ("absolute z-score of 2.5 or more AND ... n of at least 5"), then `model: "claude-haiku"`, `perDayCents: 40`.
**VO:** "This is wake-and-compare: the daily wake rebuilds each metric's baseline with SQL, scores today against it, and alerts past two-and-a-half sigma. Haiku, forty cents a day, capped."

## Deploy + stream (24-36s)

**Screen:** `npm run deploy kpi-anomaly-watcher`, then a loop of `curl .../record` calls scrolling fast — signups, mrr, churn — each instant. Then `curl .../start -d '{}'`.
**VO:** "Ingest is a free SQLite insert — point your pipeline at it and forget it. One start call arms the daily wake."

## Money shot — weeks of silence, then one sentence (36-60s)

**Screen:** Run log time-lapse: `watch → all quiet` ×14, each run under a cent. Memory panel shows `baseline:signups {mean: 138, std: 31}` updating daily. Then day 15: `signups: z=-3.1 ANOMALY` — one send_alert fires. Next day: `all quiet` again.
**VO:** "Two weeks of all-quiet, fractions of a cent each — that's the agent keeping its baselines honest. Day fifteen: one alert, with the number, the baseline, and the z-score. Then silence again. Silence is the deliverable."

## CTA (60-70s)

**Screen:** README catalog, kpi-anomaly-watcher row.
**VO:** "kpi-anomaly-watcher, from oncell-cookbook. Wire send_alert to Slack, stream your numbers in, start it once. Link below."
