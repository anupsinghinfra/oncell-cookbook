# Video script — seo-rank-tracker (70s)

## Hook (0-10s)

**Screen:** A $99/mo SERP dashboard, line charts jittering. A Slack message: "we dropped 2 spots!!" Then a calm weekly report: "Movers: 'agent scheduling' 18 → 9. Everything else: noise."
**VO:** "Rank data should be collected daily and read weekly. Doing both on the same clock is why your dashboard makes you anxious instead of informed."

## The file (10-25s)

**Screen:** `usecases/seo-rank-tracker/agent.js`. Highlight the two wake procedures — `check ... in 1 day` and `trend ... in 7 days` — then `model: "claude-haiku"` and the rule "Never dramatize a 1-spot wiggle".
**VO:** "Two-speed telemetry: a haiku-cheap daily chain that only writes rows, and a weekly chain that only reads them. The editorial taste is compiled into the identity — three-spot moves get a line, wiggles get a table row."

## Deploy + track (25-37s)

**Screen:** `npm run deploy seo-rank-tracker`, then `curl .../track` ×5 fast — zero tokens each. Then `curl .../start -d '{}'`. Dashboard: `check · in 1 day`, `trend · in 7 days`.
**VO:** "Keywords load as free inserts. One start call arms both clocks."

## Money shot — pennies, then a verdict (37-60s)

**Screen:** Run log time-lapse: `check → 43 keywords logged` ×7, each under a cent. Then Sunday: `trend` fires, `reports/2026-W32.md` opens — "Into the top 10: 'agent scheduling' 18 → 9" highlighted, full table below. `curl .../history` shows the raw daily series behind the line.
**VO:** "Seven days of sampling: cents. One day of thinking: a report with movers first and the noise kept in its place. And the raw series is always there — a free SQL read away."

## CTA (60-70s)

**Screen:** README catalog, seo-rank-tracker row.
**VO:** "seo-rank-tracker, from oncell-cookbook. Wire serp_lookup to your SERP API, load your keywords, start it once. Cancel the dashboard. Link below."
