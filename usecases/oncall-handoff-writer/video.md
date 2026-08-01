# Video script — oncall-handoff-writer (70s)

## Hook (0-10s)

**Screen:** Slack, Monday 9:02 AM: "handoff: quiet week, nothing major 👍". Cut to a dashboard behind it: "sev2 — OPEN — 6 days". New on-call's avatar with a pager notification 40 minutes later.
**VO:** "The handoff was three words. The open sev2 was six days old. The next engineer found out the hard way."

## The file (10-24s)

**Screen:** `usecases/oncall-handoff-writer/agent.js`. Highlight the doc structure in the identity — "Still open ... the section the next on-call actually needs" — and the closing "schedule with in set to 7 days and note set to handoff".
**VO:** "Report-at-boundary: incidents stream in all week as free database writes, and one wake at the rotation turn compresses the week into a doc. Judgment fires exactly once, at the edge."

## Deploy + ingest (24-36s)

**Screen:** `npm run deploy oncall-handoff-writer`, then `curl .../log-incident` ×4 scrolling — "Logged sev2: API latency spike (resolved)", "Logged sev2: queue backlog (OPEN)" — instant, zero tokens. Then `curl .../start -d '{}'`.
**VO:** "Wire your pager's webhook to log-incident — the week logs itself for nothing. Start arms the weekly boundary."

## Money shot — rotation day (36-60s)

**Screen:** Day 7: wake fires. `handoffs/2026-08-08.md` opens: "Still open: queue backlog (sev2, 4 days)" at the top, week's one-liners, "Patterns worth knowing: two incidents traced to the cache layer", counts at the bottom. Next week's doc — the still-open sev2 appears again, now "11 days".
**VO:** "Rotation day: open items first, oldest first. And watch next week — anything still open carries forward, aging in public, until someone closes it. Nothing rots silently between rotations."

## CTA (60-70s)

**Screen:** README catalog, oncall-handoff-writer row.
**VO:** "oncall-handoff-writer, from oncell-cookbook. Point your pager at it, start it on rotation day, and never inherit a mystery again. Link below."
