# Video script — subscription-auditor (75s)

## Hook (0-10s)

**Screen:** A credit-card statement scrolling: Figma, Datadog, Airtable, Miro, three tools nobody recognizes. Freeze on the total. Overlay: "$214,000/yr".
**VO:** "Ten to thirty percent of your SaaS spend is paying for ghosts. You planned a quarterly audit. It happened once."

## The file (10-25s)

**Screen:** `usecases/subscription-auditor/agent.js`. Highlight the zombie rule one-liner, then "call ask_human once with the full flagged list", then "schedule with in set to 30 days".
**VO:** "One agent, one day a month. The zombie rule is a sentence. The cancellation is behind a human. And the schedule is a thirty-day wake the runtime owns — long-period crons rot; ledger entries don't."

## Deploy + sync (25-38s)

**Screen:** `npm run deploy subscription-auditor`, then a loop of `curl .../upsert-subscription` and `curl .../mark-used` calls — all instant, zero tokens. Then `curl .../start -d '{}'`. Dashboard: `audit · in 30 days`.
**VO:** "The ledger syncs in for free — SQLite upserts, no model. Wire your SSO events to mark-used and usage tracks itself. Start arms the month."

## Money shot — audit day (38-65s)

**Screen:** Day 30, wake fires. Run parks: "Flagged: Miro $9,600/yr (owner left, 142 days idle), Airtable $6,120/yr (91 days idle). Draft cancellations for which?" Cost meter $0 while parked, 2 days pass. Human replies "Miro yes, Airtable no." Trace: draft_cancellation(Miro) fires, Airtable flips back to active, `audit · in 30 days` re-books.
**VO:** "Audit day: two zombies, sixteen grand a year, one question — parked at zero dollars until finance answers. Miro: drafted. Airtable: reprieved, and it won't be re-litigated next month. Next audit books itself."

## CTA (65-75s)

**Screen:** README catalog, subscription-auditor row.
**VO:** "subscription-auditor, from oncell-cookbook. Sync your ledger, arm it once, and let the one-day-a-month employee find the ghosts. Link below."
