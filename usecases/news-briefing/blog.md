---
title: The Morning Brief that Learns Without a Model
description: The preference-tuned cadence on OnCell — a fixed daily wake reading weight dials that zero-LLM feedback adjusts, so the brief reshapes itself day by day.
date: 2026-08-01
slug: news-briefing
---

# The Morning Brief that Learns Without a Model

Every news product converges on the same two bad endpoints. The static digest sends you the same five sections forever, three of which you stopped reading in March. The engagement-optimized feed learns what you *click* — which is not what you *value* — and two months later you're somehow subscribed to outrage. Between them sits the thing you actually want: a brief with stable topics whose *emphasis* drifts toward what you engage with, visibly, correctably, without an ML pipeline deciding who you are.

`news-briefing` is that middle thing, and it demonstrates the **preference-tuned cadence**: the schedule never changes — one wake per day, forever — while the *state the wake consumes* changes continuously. The cadence provides repetition; the state provides learning; the agent between them just reads its dials every morning.

## Learning is two multiplications, not a model

Here's the part worth stealing. The feedback loop in [`agent.js`](agent.js) contains no LLM at all:

```js
for (const topic of liked) {
  updated[topic] = Math.min(MAX_WEIGHT, updated[topic] * LIKE_FACTOR);   // ×1.25
}
for (const topic of skipped) {
  updated[topic] = Math.max(MIN_WEIGHT, updated[topic] * SKIP_FACTOR);   // ×0.8
}
```

`feedback` is a zero-token task: tell it what you read and what you skipped, and it nudges the `topic_weights` map — multiplicative, clamped to [0.2, 3.0], named constants — and returns the new dials so you can *see* what the system now believes about you. Send feedback five times a day if you like; it costs nothing. The learning lives in state; the model never touches it. Tomorrow's wake reads whatever the dials say and writes a differently-shaped brief.

That division — cadence fixed, state drifting, judgment daily — is the whole pattern, and it's why the agent stays legible. Your preference profile isn't buried in fine-tuned weights; it's one memory key you can read, edit, or reset with a curl.

## Ink follows weight — but never to zero

The identity turns the dials into editorial layout: heavy topics (≥ 2.0) get a titled section with a synthesis line, middling ones get two items, light ones (≤ 0.5) shrink to a one-liner under *Briefly*. Two guardrails keep the drift honest. First:

> "a low weight shrinks a topic, it never silences it, because the reader changes their mind and the brief is where they notice."

The clamp floor of 0.2 plus the every-topic-appears rule is the anti-filter-bubble mechanism — skipped topics fade to a whisper but keep a heartbeat, so the day kubernetes matters again, it's still on the page to be liked back up. Second: "Lead with the day's most consequential item across all topics, regardless of weight." The dials are preferences, not blinders; an editor overrides them for news that matters.

## The usual machinery, because conventions compound

Everything else follows the collection's standards, and by the sixteenth scheduled agent they should look like muscle memory: the `brief` wake ends with `schedule` — `in` 1 day, note `brief` — the self-rebooking chain. `set-topics` is zero-LLM config and the smoke task (declaring interests must never arm the infinite chain). `start` clears `briefing_stopped` and runs one pass; `stop` flips the flag the next wake reads and obeys — stand-down through state, no cancellation API. One sonnet pass a day under `maxCost: 0.5` and `perDayCents: 100`; `latest` reads the newest brief back for zero tokens.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy news-briefing
```

Declare, arm, then steer with your thumbs:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/news-briefing/set-topics \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"topics": ["ai infrastructure", "devtools funding", "kubernetes"]}'

curl -X POST .../news-briefing/start -d '{}'
curl -X POST .../news-briefing/feedback -d '{"liked": ["ai infrastructure"], "skipped": ["kubernetes"]}'
```

Day one, three equal sections. Two weeks of honest feedback later: *ai infrastructure* leads with four items and a synthesis line, *kubernetes* is one line under Briefly — still there, still ready for its comeback. The brief became yours by drift, and you can inspect exactly how: the dials are just JSON.

## What you didn't have to build

A recommender system and the pipeline feeding it. A preferences database. An unsubscribe-in-spirit detector for sections people stopped reading. Guardrails against your own filter bubble. A daily cron and its host.

You wrote two multiplications and an ink rule. The cadence repeats, the state drifts, and the brief learns — with the model nowhere near the learning.
