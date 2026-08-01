# Video script — churn-detector (75s)

## Hook (0-10s)

**Screen:** An email: "We've decided not to renew." Below it, a usage graph rewinds 6 weeks — logins thinning, a seat removed, a billing failure — each signal lighting up red as the timeline scrubs backwards.
**VO:** "No account churns on the day it churns. The signals were all there, six weeks early — in a dashboard nobody opens. This agent opens it every Monday."

## The file (10-26s)

**Screen:** `usecases/churn-detector/agent.js`. Highlight the `event` handler — no `agent.llm` call — then the `churn-rubric` skill with its four weighted signals, then the line "never vague phrases like low engagement."
**VO:** "Ingestion is a zero-token task — validate, insert into SQLite, free at any volume. The scoring model is a rubric in a skill: silence, shrinkage, friction, disengagement. Readable, diffable, and banned from vagueness — reasons must be concrete."

## Deploy + stream (26-40s)

**Screen:** `npm run deploy churn-detector`. A rapid montage of event curls: `login`, `login`, `seat_removed`, `billing_failure` — each instant, traces showing zero LLM steps.
**VO:** "Deploy, point your analytics pipeline at the event task, and let a week of usage pile up for exactly nothing."

## Money shot — Monday's answer (40-65s)

**Screen:** `curl .../score -d '{}'` → "acme: 75 (at-risk) - no login in 16 days / northwind: 55 (watch) - 2 support tickets, logins halved". Dashboard shows wake `score · in 7 days`. Then a CS lead edits the skill — `10 per billing_failure` becomes `15` — and redeploys; git diff on screen.
**VO:** "Monday: at-risk accounts, ranked, each with a reason a CSM can act on — 'no login in 16 days', not 'point seven three'. Next Monday is already booked. And when CS wants billing failures weighted heavier? One line, one redeploy — the scoring model has a git history."

## CTA (65-75s)

**Screen:** README catalog, churn-detector row.
**VO:** "churn-detector, from oncell-cookbook. Four signals, two thresholds, and the right three names in the CS channel — six weeks before the cancellation email. Link below."
