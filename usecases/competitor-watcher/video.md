# Video script — competitor-watcher (70s)

## Hook (0-8s)

**Screen:** A Slack channel `#competitors`: a screenshot pasted 3 months ago, "did anyone see this??", zero replies since.
**VO:** "Competitive intel dies of boredom — because ninety-five percent of checking is finding nothing. So give the boredom to an agent, and keep the three bullets."

## The file (8-24s)

**Screen:** `usecases/competitor-watcher/agent.js`. Highlight the `snapshot:<name>` baseline description in the identity, then "Cosmetic rewording is not a change", then the output contract ending "or the single line no changes across N pages".
**VO:** "The trick is the baseline: a structured summary of each page, kept in durable memory. Every sweep re-reads, compares meaning against meaning — a price move counts, a reworded button doesn't — and writes the new baseline back."

## Deploy + baseline (24-38s)

**Screen:** `npm run deploy competitor-watcher`. Curl `watch` for `acme-changelog` and `acme-pricing`. First `sweep` → "acme-changelog: baseline captured. acme-pricing: baseline captured."
**VO:** "Deploy, register the landscape, sweep once. First pass captures baselines — no false fireworks. And tomorrow's sweep is already booked, by the agent."

## Money shot — the Tuesday it matters (38-62s)

**Screen:** Dashboard: wake `sweep · in 1 day`. Time-skip over several quiet sweeps, each: `no changes across 2 pages`. Then one morning: "acme-pricing: Pro plan $79 -> $99 (+25%) - narrows our price gap to $10. acme-changelog: new SSO entry on Starter - undercuts our enterprise gate."
**VO:** "Day after day: one line of silence. Then the Tuesday it matters: a price hike and an SSO launch — with the analyst's *why it matters* attached. A redeploy never wipes the baseline; it lives in the runtime, not the process."

## CTA (62-70s)

**Screen:** README catalog, competitor-watcher row.
**VO:** "competitor-watcher, from oncell-cookbook. Point the stub at your fetcher, pipe the digest into Slack, and let the channel be quiet until it shouldn't be. Link below."
