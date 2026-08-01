---
title: Your FAQ Is a Guess. This One Is a Count.
description: An agent that clusters real support questions in SQLite, transcript by transcript, and generates a FAQ ranked by evidence instead of opinion.
date: 2026-08-01
slug: faq-builder
---

# Your FAQ Is a Guess. This One Is a Count.

Open your product's FAQ page and ask an uncomfortable question: where did this list come from? Almost always, the answer is a conference room — someone imagined what customers would ask, someone else wordsmithed it, and the result is a monument to what the team *wishes* people asked. Meanwhile the real questions arrive hundreds of times a month, in support tickets, phrased forty different ways, answered by hand every single time, and thrown away.

The data to build the true FAQ exists. The reason nobody builds it is the middle step: "how do I cancel," "where do I stop my subscription," and "can't find the cancel button?" are one question wearing three outfits, and grouping them is a language-judgment task. Regex won't do it; embedding pipelines will, but now you're running a vector store, a clustering job, and a threshold-tuning hobby for what is, at heart, counting.

`faq-builder` does the counting with judgment in the loop, one transcript at a time.

## Clustering as a per-ticket decision

Each `ingest` call runs a cheap loop over one transcript, and the identity in [`agent.js`](agent.js) defines the matching rule as an analyst would:

> "Clustering is judgment: how do I cancel and where do I stop my subscription are the same question; how do I cancel and how do I pause are not. When a transcript question matches an existing canonical, increment variants and improve answer_hint if the transcript answered it better. Otherwise insert a new row with variants 1."

The accumulator is a real SQLite table — `questions(canonical, variants, answer_hint, last_seen)` — that outlives every run. Note `answer_hint`: the agent doesn't just count questions, it keeps the best answer any support agent has given, upgrading it whenever a transcript explains something better. Your FAQ answers end up written, in effect, by your own best support moments.

There's a filter with taste, too: agent questions, pleasantries, and one-off account issues don't count — "no FAQ could answer" them, so they'd only pollute the ranking.

Because this runs per ticket, economics matter more than eloquence: `claude-haiku`, `{ maxSteps: 10, maxCost: 0.08 }` per ingest, `perDayCents: 150` overall. Wire your helpdesk's ticket-closed webhook at it and a busy support day costs less than a coffee refill.

## The build is just reading the evidence

`build {}` orders by `variants` descending and writes `faq.md` — title, a provenance line ("generated from N clustered questions"), then each question with a 2–4 sentence answer grown from its hint. Singleton questions are skipped once the table has depth, so the FAQ stays an FAQ instead of an everything-anyone-ever-asked page. And the ranked raw clusters are always one zero-token call away:

```js
agent.task("top", async () => {
  ...
  const result = await agent.db.sql`SELECT canonical, variants FROM questions ORDER BY variants DESC LIMIT 20`;
  return result.rows;
});
```

That `top` output is a product artifact in its own right — it's your users telling you, in ranked order, what your UI fails to make obvious.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy faq-builder
```

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/faq-builder/ingest \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Customer: How do I cancel my plan?\nAgent: Settings > Billing > Cancel..."}'
```

Each ingest answers with its clustering decisions — `matched how do I cancel my subscription (now 14)` or `new can I export my data before leaving` — so you can audit the judgment in real time. When you want the artifact: `curl .../build -d '{}'` and publish `faq.md` as-is.

## What you didn't have to build

An embedding pipeline, a vector database, and the clustering-threshold tuning that goes with them. A counters table with concurrency handling. An answer-quality curation process — `answer_hint` curates itself. A batch job to regenerate the page. The runtime keeps the SQLite durable, the loop cheap, and the whole thing under $1.50 a day.

You defined what "the same question" means. The customers write the FAQ from here — ranked by how loudly they already voted.
