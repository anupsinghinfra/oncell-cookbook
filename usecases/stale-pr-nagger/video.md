# Video script — stale-pr-nagger (75s)

## Hook (0-10s)

**Screen:** A Slack channel wall: `⏰ PR #481 needs review!` ×9, consecutive days. Right-click → Mute channel. Cut to a single friendly DM: "Morning Sam — 3 PRs waiting on you: #481, #492, #495."
**VO:** "Every stale-PR bot gets muted in three weeks — not because it fires at the wrong time, but because it can't remember it already asked."

## The file (10-26s)

**Screen:** `usecases/stale-pr-nagger/agent.js`. Highlight the fatigue rules ("skip if last_nagged is today; skip if count ... is 3 or more"), the tone ladder, and the weekday `at` computation. Then `model: "claude-haiku"`.
**VO:** "The fatigue-aware cadence: a weekday-morning wake — Friday books Monday — that checks a per-reviewer memory before it's allowed to speak. Once a day per person, three a week, all their PRs in one message. Haiku, pennies."

## Deploy + arm (26-38s)

**Screen:** `npm run deploy stale-pr-nagger`, `curl .../start -d '{}'`. Run log: "sam: nagged (3 PRs) · priya: skipped (nagged yesterday) · all others: all clear. Next wake 2026-08-03T09:30:00Z" — calendar overlay shows Monday.
**VO:** "One start call. The morning report is a triage sheet, not a siren — and look at the next wake: it computed its way past the weekend."

## Money shot — the third nag and the snooze (38-65s)

**Screen:** Thursday's DM to Sam opens: "Third time this week, I know —" with the two remaining PRs. Friday: `sam: skipped (3 this week)`. Then `curl .../snooze -d '{"reviewer":"sam","days":5}'` — instant. Next week's wakes: `sam: skipped (snoozed until Wed)`. `curl .../fatigue` shows the whole ledger as JSON.
**VO:** "Third nag of the week admits it's the third — then the counter cuts Sam off until Monday. And Sam can buy quiet with one free snooze call: the wakes read the timestamp and skip him. The restraint is state, not politeness theater."

## CTA (65-75s)

**Screen:** README catalog, stale-pr-nagger row.
**VO:** "stale-pr-nagger, from oncell-cookbook. Wire the stubs to GitHub and Slack, start it once, and stay off the mute list. Link below."
