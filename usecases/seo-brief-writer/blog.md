---
title: Content Briefs a Writer Can Execute Without a Follow-Up Question
description: A brief-writing agent with a versioned editorial standard, SERP grounding through one stub tool, and a durable library your whole calendar links into.
date: 2026-08-01
slug: seo-brief-writer
---

# Content Briefs a Writer Can Execute Without a Follow-Up Question

The dirty secret of content operations is that the brief is the bottleneck, not the writing. A good brief takes a strategist ninety minutes: pull the SERP, read ten competing pages, extract the heading themes, find the gap nobody covers, list the entities that make the piece credible, collect the people-also-ask questions. Skip any of it and the writer either asks you eleven questions or — worse — doesn't, and you get 1,800 fluent words that rank for nothing.

So teams ration briefs. The calendar says twelve posts a month; the strategist produces five real briefs and seven "just cover the basics" Slack messages. The five perform. The seven don't. Everyone concludes content doesn't work.

`seo-brief-writer` makes the brief the cheap part again — and it does it with an *auditable editorial standard*, not a lucky prompt.

## The standard is a skill

The entire house format lives in one skill in [`agent.js`](agent.js) — six numbered sections, in order, every time:

```js
const briefFormat = skill("brief-format", {
  description: "The house structure for a content brief: title options, outline, entities, FAQs, and internal links, grounded in SERP data.",
  instructions: "Brief structure - every section, in this order:\n1. Target: the keyword, inferred search intent...\n3. Outline: H2s and nested H3s that cover every heading theme the top results share, plus at least one angle none of them cover - mark it GAP.\n...",
  tools: [serpLookup, tools.files],
});
```

Notice section 3's rule: cover every shared heading theme *and* add at least one angle none of the competitors have, marked `GAP`. That's the difference between a brief and a summary of page one — and because it's a skill, it's versioned. When your SEO lead decides briefs need a schema-markup section, that's a one-line edit and a redeploy, applied identically to every brief afterward. While the skill is active, the agent's tools narrow to exactly `serp_lookup` and `files`: research and write, nothing else.

## Grounded, by contract

The identity draws a hard line most "AI SEO tools" blur:

> "serp_lookup is your only source of search-landscape data; call it exactly once per brief and ground every competitive claim in what it returns. Never invent rankings or search volumes."

`serp_lookup` is the file's one stub — a custom tool whose `run` body you point at DataForSEO, SerpAPI, or your own crawl. The sandbox has no network, so this tool is the *only* window to the SERP, which makes the grounding rule enforceable in the trace: every competitive claim in a brief maps to one visible tool call.

## A library, so briefs link to briefs

Every brief lands at `briefs/<keyword-slug>.md` on the agent's durable filesystem — and section 6 of the format uses that: internal-link suggestions reference *other briefs in the library*. The more you brief, the more interlinked your content plan becomes, automatically. The `library` task reads the index for zero tokens:

```js
agent.task("library", async () => {
  const names = await agent.files.list("briefs");
  return Array.isArray(names) ? names.sort() : [];
});
```

Each brief run is one managed loop capped at `{ maxSteps: 12, maxCost: 0.6 }`, under a $3/day identity budget — a full month's calendar of briefs for less than one strategist-hour.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy seo-brief-writer
```

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/seo-brief-writer/brief \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"keyword": "warehouse slotting optimization"}'
```

The answer is deliberately terse — path, recommended title, H2 list — because the deliverable is the file. Open `briefs/warehouse-slotting-optimization.md` and hand it to a writer; rerun the same keyword next quarter and the identity's refresh rule overwrites it with the current SERP landscape.

## What you didn't have to build

A SERP-scraping pipeline with storage. A templating system for brief structure. A shared drive taxonomy that three people maintain and nobody follows. Version control for your editorial standards — the skill diff *is* the changelog. Spend controls for the day someone briefs 400 keywords — the per-run cap and daily ceiling are runtime-enforced.

You wrote your editorial standard once and pointed one stub at your SERP provider. Brief production is now a curl in a loop — and the writer never has to ask what you meant.
