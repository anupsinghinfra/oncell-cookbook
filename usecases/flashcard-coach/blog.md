---
title: Five Hundred Cards, Five Hundred Clocks
description: Per-item wake chains on OnCell — every flashcard computes its own next review instant from your performance, and the runtime durably keeps one timeline per card.
date: 2026-08-01
slug: flashcard-coach
---

# Five Hundred Cards, Five Hundred Clocks

Spaced repetition is the most evidence-backed learning technique we have, and its core demand is the one thing software finds awkward: *every single item needs its own schedule.* The card you know cold should not return for a month. The card you blew this morning should return in ten minutes. Multiply by a deck, and you have hundreds of independent timers, each rescheduling itself based on human performance.

Anki solves this with a client-side queue you must open — the app does nothing until you show up, which is why streaks die. Build it server-side yourself and you're suddenly maintaining a jobs table, a polling worker, per-item reschedule logic, and recovery for the timers a deploy dropped. The scheduling *is* the product, and the scheduling is all infrastructure.

`flashcard-coach` is that product as one file, and it's the flagship of this collection's scheduling patterns: **per-item wake chains**. There is no deck-level cadence anywhere in [`agent.js`](agent.js) — no "daily review session", no cron sweep looking for due cards. Each card's review ends by computing *that card's* next due instant and booking a wake for it:

> "...set due_at to now plus interval_days, keep chained at 1, and call schedule with at set to due_at and note set to review &lt;id&gt;. Each card books only its own next wake - never another card's."

The wake note carries the item identity (`review 17`), the wake time is computed from item state, and OnCell's runtime holds one durable ledger entry per card. A 500-card deck is 500 independent chains — costing $0 while parked, surviving redeploys, drifting apart as your memory shapes them. The schedule isn't a loop over the data. The schedule *is* the data.

## The review is a park, the grade is the input

When `review 17` fires, the agent doesn't notify you — it *asks* you, via `ask_human`: the card front, an instruction to recall before peeking, the back below a SPOILER line, and a request for a grade 0-5. The run parks at zero cost until you answer — ten minutes or two days, the chain doesn't care. Your grade feeds a simplified SM-2, written into the identity as arithmetic the model applies: forgot (< 3) means reps reset, ease down 0.2, and the card returns in ~10 minutes; remembered means the interval grows — 1 day, 3 days, then `interval × ease` — with ease nudged by how confident the grade was. One card settles into monthly orbit while its neighbor thrashes at day-one. Divergence is the feature.

## The chained bit: bookkeeping for a thousand timelines

Per-item chains introduce a failure mode cadence agents never meet: double-booking. If `start` naively scheduled a wake per card, running it twice would give every card two competing timelines. The deck schema carries one integer for exactly this — `chained` is 1 while a card has a pending wake — and `start` only arms cards where it's 0. Every way a chain ends *clears the bit*: a wake that finds its card retired, or finds `coach_stopped` set, stands down and zeroes `chained` on the way out. So `start` is idempotent-by-state — always safe to call, it rebuilds precisely the chains that are down, and reports "12 chains started, 488 already running."

Stopping follows the same coordination-through-state rule as every chain in this repo, scaled to N: `stop` flips *one* memory flag, and five hundred pending wakes each read it, unchain themselves, and end. No cancellation API, no iteration over pending jobs. `retire` does it per-card with one zero-LLM `UPDATE`.

And the deck builds for free: `add-card` is a SQLite insert — zero tokens, and deliberately *no scheduling*. That's the smoke task, and the collection's rule: ingest must never arm an infinite chain. Arming 500 timelines is what `start` is for.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy flashcard-coach
```

Build a deck (zero tokens per card):

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/flashcard-coach/add-card \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"front": "What does the schedule tool record?", "back": "A durable wake intent - the runtime owns time and wakes the agent with the note as a fresh prompt"}'
```

Then `curl -X POST .../start -d '{}'` — and watch `deck` (a zero-token read) over a week: `interval_days` fanning out from 1 to 3 to 7.5 on the cards you know, `lapses` climbing on the ones you don't, `due_at` timestamps scattering across the calendar like a schedule no human wrote. Because none did.

## What you didn't have to build

A jobs table with one row per card and the worker that polls it. Reschedule-on-answer logic. Recovery for timers lost mid-deploy. A session queue to batch reviews because per-item timers were too expensive. They aren't here: a wake intent is a ledger row, and the runtime will happily keep five hundred of them, or fifty thousand.

You wrote SM-2 in a paragraph and the sentence "each card books only its own next wake." The runtime keeps the clocks — all of them.
