---
title: Watch Every Competitor Page — Hear Only the Diffs
description: A daily competitive-intel sweep whose baseline lives in durable memory, so you get three bullets when something changes and silence when nothing does.
date: 2026-08-01
slug: competitor-watcher
---

# Watch Every Competitor Page — Hear Only the Diffs

Competitive intel in most companies is a Slack channel called #competitors where someone occasionally pastes a screenshot with "did anyone see this??" The formal version — a weekly rotation where a PM reads five changelogs and three pricing pages — lasts exactly as long as the PM's patience, because 95% of those reads end in "nothing new." Humans are terrible at jobs where the usual outcome is nothing, and page-monitoring tools overcorrect: they diff HTML, so a rotated testimonial or a re-rendered date fires the same alert as a price increase.

What you actually want is an analyst's judgment applied daily: *did anything change in a way that changes meaning?* That requires two things software rarely has together — a durable baseline of what each page used to say, and enough language understanding to know that "Pro plan, $79" → "Pro plan, $99" matters while "Sign up today" → "Get started today" doesn't.

`competitor-watcher` has both, in one file.

## The baseline is what makes it a diff

The identity in [`agent.js`](agent.js) gives the agent two memory shapes: `page:<name>` for what to watch, and the interesting one —

> "Memory keys snapshot:<name> - your last structured summary of that page: the notable claims, prices, features, and dated entries, condensed to under 200 words. This is the baseline you diff against."

Each sweep fetches the page (through `fetch_page`, the one stub — the sandbox has no network, so your scraping API goes in its `run` body), re-summarizes it the same structured way, compares against the stored snapshot, and writes the fresh summary back. Because the snapshot is a *semantic* summary rather than an HTML hash, the diff is semantic too — the identity draws the line explicitly: "Cosmetic rewording is not a change."

Note the storage decision: the baseline is durable KV, not a scratch file in a process that restarts. A redeploy doesn't amnesia the watcher into re-reporting the entire page as "new" — the failure mode that kills every homegrown monitor within a month. The first-watch case is handled in the same breath: no snapshot means "baseline captured," never a wall of false changes.

## Silence is the feature

The output contract makes "nothing happened" cheap to consume:

> "Answer with one section per page that changed - the page name, then 1 to 3 bullets on what changed and why it might matter - or the single line no changes across N pages when nothing did."

One line of silence, or a few bullets with an analyst's *why it might matter* attached. That's a digest you can pipe into #competitors without training anyone to ignore it.

The cadence is the cookbook's standard self-booking move — every sweep ends with "call schedule with in set to 1 day and note set to sweep," a durable wake intent, with `agent.schedule("daily-sweep", "daily", ...)` as the bootstrap. Each sweep is capped at `{ maxSteps: 20, maxCost: 0.6 }` under a $2/day identity budget, and the `baselines` task dumps everything the watcher currently remembers for zero tokens — handy when you want to audit what it thinks Acme's pricing is.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy competitor-watcher
```

Register the landscape and run the first sweep:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/competitor-watcher/watch \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "acme-changelog", "url": "https://acme.example/changelog"}'

curl -X POST https://api.oncell.ai/api/v1/agents/competitor-watcher/sweep -d '{}'
```

Sweep one reports baselines captured. Sweep forty-one, some Tuesday, reports "acme-changelog: new entry announcing SSO on the Starter plan - undercuts our enterprise gate" — and that's the first you'll have needed to think about it.

## What you didn't have to build

A scraping scheduler and its host. Snapshot storage with retention. An HTML-diff engine and the false-positive suppression layer it demands. A summarization pipeline. The discipline to check eight pages every day for months of "nothing" — which is the part no human team ever sustains.

You wrote the definition of a meaningful change and pointed one stub at a fetcher. The watcher reads every day so nobody has to — and only speaks when it would have been worth a meeting.
