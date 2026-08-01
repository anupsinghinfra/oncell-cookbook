# Video script — social-scheduler (75s)

## Hook (0-10s)

**Screen:** A Notion doc titled "Posts to publish!!" — last edited 3 months ago, five drafts. Cut to a feed showing one post going out per day, then a Sunday rollup: "Best performer: the pricing thread, 212 likes."
**VO:** "You don't have a content problem. You have a clock problem. Two clocks, actually."

## The file (10-25s)

**Screen:** `usecases/social-scheduler/agent.js`. Highlight the two wake procedures side by side — "note set to publish ... in 1 day" and "note set to rollup ... in 7 days".
**VO:** "This is the interleaved-cadences pattern. The wake note is a dispatch key: one note re-books itself daily, the other weekly. Two chains, one agent, one SQLite queue between them."

## Deploy + queue (25-38s)

**Screen:** `npm run deploy social-scheduler`, then three fast `curl .../queue-post` calls — "3 post(s) waiting", zero tokens. Then `curl .../start -d '{}'`. Dashboard shows two pending wakes: `publish · in 1 day`, `rollup · in 7 days`.
**VO:** "Queueing is a free SQLite insert. One start call arms both clocks — you can see both wakes sitting in the ledger."

## Money shot — the week runs itself (38-65s)

**Screen:** Time-lapse of the dashboard: publish wake fires ×7, each run a few cents, one post out per day. Day 4: queue empty — run answers "queue empty", books tomorrow anyway. Sunday: rollup wake fires, `rollups/2026-W32.md` appears with the week's table and "what worked".
**VO:** "Seven publishes, each a few cents. Day four the queue runs dry — the chain doesn't die, it shrugs and books tomorrow. Sunday, the other clock fires: numbers pulled, rollup written, next Sunday booked. Nobody touched anything."

## CTA (65-75s)

**Screen:** README catalog, social-scheduler row.
**VO:** "social-scheduler, from oncell-cookbook. Wire the two stubs to your platform, fill the queue, start it once. Link below."
