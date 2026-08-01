# Video script — retro-facilitator (75s)

## Hook (0-10s)

**Screen:** A shared doc titled "Sprint 41 Retro 🎉" — empty except one bullet, last edited 12 days ago. Cut to a Slack channel: "Retro cycle 7 is open", then later "3 themes from cycle 7: Deploy freezes work. On-call handoffs don't. Docs rot."
**VO:** "Async retros die of bad choreography: no bell, no nudge, no synthesis. So make the choreography the agent."

## The file (10-26s)

**Screen:** `usecases/retro-facilitator/agent.js`. Highlight the three wake procedures and their hand-offs: open → "in 4 days, note remind" → remind → "in 3 days, note close" → close → "in 7 days, note open".
**VO:** "The multi-phase cycle pattern: one retro, three phased wakes, each booking the next — and close books the next cycle's open. It's a state machine whose transitions are wake notes. No workflow engine anywhere."

## Deploy + entries (26-38s)

**Screen:** `npm run deploy retro-facilitator`, `curl .../start -d '{}'` → channel shows the opening bell. Then `curl .../add-entry` ×3 — instant, zero tokens. One arrives after close: "The window for this cycle is closed."
**VO:** "Entries are free SQLite inserts, stamped with the cycle — and the window is enforced by a memory key, not a model. Closed means closed."

## Money shot — the cycle turns (38-65s)

**Screen:** Timeline view: Day 0 open bell. Day 4 — remind wake: "5 entries so far, 3 days left" — entry count jumps to 11. Day 7 — close wake: `retros/cycle-7.md` appears with themes + Keep/Change/Try, channel gets the summary, dashboard shows `open · in 7 days`. Cost column: three runs, under a dollar total.
**VO:** "Day four, the nudge doubles participation. Day seven, synthesis: themes, one quote each, no names attached — that anonymity is why people wrote honestly. And the close books the next opening bell. Three model runs per fortnight, under a dollar."

## CTA (65-75s)

**Screen:** README catalog, retro-facilitator row.
**VO:** "retro-facilitator, from oncell-cookbook. Wire post_message to Slack, start it once, and cancel the meeting. Link below."
