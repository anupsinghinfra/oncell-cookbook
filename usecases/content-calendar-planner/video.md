# Video script — content-calendar-planner (70s)

## Hook (0-10s)

**Screen:** A blinking cursor on an empty doc, 9:04 AM. Browser tabs multiply. Cut to a single Slack nudge: "Today: 'Why we moved our scheduler into the runtime' — thread — angle: the cron box you deleted."
**VO:** "The hardest part of publishing isn't writing. It's deciding what today is for — every single day. So decide once a week, and let a cheaper wake do the remembering."

## The file (10-25s)

**Screen:** `usecases/content-calendar-planner/agent.js`. Highlight the two wake procedures — `plan ... in 7 days` and `remind ... in 1 day` — then the sentence "Never write or edit a plan on a remind wake".
**VO:** "The planner/executor split: a weekly wake that thinks and writes the plan file, a daily wake that's forbidden to think — it opens the file and relays today's slot. The artifact is the contract between the two chains."

## Deploy + backlog (25-38s)

**Screen:** `npm run deploy content-calendar-planner`, then `curl .../add-idea` ×5 scrolling fast — "5 idea(s) in the backlog", zero tokens. Then `curl .../start -d '{}'`. Dashboard: `plan · in 7 days`, `remind · in 1 day`.
**VO:** "Ideas drop in as free SQLite inserts. One start call runs the first planning pass and arms both clocks."

## Money shot — the week executes itself (38-62s)

**Screen:** `plans/2026-W32.md` appears: Mon-Fri, topics, formats varied. Time-lapse: five morning nudges, each run costing cents — the run log shows `remind` wakes just reading the file. Sunday: the `plan` wake fires, next week's file appears, backlog rows flip to `planned`.
**VO:** "Sunday: one thinking run writes the week. Monday to Friday: five nudges at pennies each — pure reads, no renegotiation. Next Sunday the planner wakes again and the backlog becomes another week. Two cadences, one file between them."

## CTA (62-70s)

**Screen:** README catalog, content-calendar-planner row.
**VO:** "content-calendar-planner, from oncell-cookbook. Wire the reminder to Slack, fill the backlog, start it once. Decide weekly, ship daily. Link below."
