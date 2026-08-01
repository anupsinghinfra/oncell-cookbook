# Video script — daily-digest (80s)

## Hook (0-8s)

**Screen:** A crontab file with `0 7 * * *` highlighted, then a PagerDuty-style alert: "digest-worker: host unreachable".
**VO:** "Your daily digest didn't die because summarizing is hard. It died because 'every morning' means babysitting a cron box. Delete the cron box."

## The file (8-24s)

**Screen:** `usecases/daily-digest/agent.js`. Highlight `capabilities: [tools.memory, tools.db, tools.files, tools.schedule]`, then the identity line "...call schedule with in set to 1 day and note set to digest".
**VO:** "One agent. It owns a SQLite table for notes, files for the briefings, and one special capability: schedule. Its instructions end every digest the same way — book tomorrow."

## Deploy + feed it (24-40s)

**Screen:** Terminal: `npm run deploy daily-digest`. Then two quick curls to `/add-note`: "Shipped checkout flow to 10%", "Postponed the pricing change to Q4".
**VO:** "Deploy in one command, then toss it notes all day from anywhere — Slack hook, CLI, CI."

## Money shot — the self-scheduling digest (40-68s)

**Screen:** `curl -X POST .../daily-digest/digest -d '{}'`. Show the returned briefing: Highlights, Decisions, Follow-ups. Cut to the dashboard: a scheduled wake entry for tomorrow 7am, labelled "digest". Then dramatic beat: a deploy happens (`npm run deploy daily-digest` again, v2) — the wake entry is still there.
**VO:** "It writes the briefing — then schedules its own tomorrow as a durable intent in the runtime. Watch this: redeploy the agent... the wake survives. Crash the host — it survives that too. While it waits, it costs zero. The runtime owns time; the agent just asks."

## CTA (68-80s)

**Screen:** README catalog table, daily-digest row highlighted.
**VO:** "daily-digest, from oncell-cookbook. One file, no infrastructure, two dollars a day, capped by the runtime. Clone it and never restart a cron box again. Link below."
