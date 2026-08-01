# Video script — flashcard-coach (85s)

## Hook (0-10s)

**Screen:** An Anki streak counter breaking: "473 days" → "0". Cut to a phone notification at 9:41 AM: "review 17: What does the schedule tool record? (recall before peeking)".
**VO:** "Spaced repetition works — when the schedule works. This deck doesn't wait for you to open an app. Every card has its own alarm clock, and the runtime is holding all five hundred of them."

## The file (10-26s)

**Screen:** `usecases/flashcard-coach/agent.js`. Highlight "Each card books only its own next wake - never another card's", then the SM-2 grading paragraph, then `capabilities: [tools.db, tools.memory, tools.schedule, tools.ask_human]`.
**VO:** "Per-item wake chains — the flagship pattern. No deck cadence, no cron sweep. A review ends by computing that card's next due instant from your grade and booking a wake at it. The schedule isn't a loop over the data. The schedule is the data."

## Deploy + deck (26-38s)

**Screen:** `npm run deploy flashcard-coach`, then `curl .../add-card` ×5 fast — zero tokens. `curl .../start -d '{}'` → "5 chains started, 0 already running." Dashboard: five pending wakes, one per card.
**VO:** "Cards are free inserts — adding never schedules. One start call arms a chain per card. Five cards, five independent clocks."

## Money shot — the timelines diverge (38-70s)

**Screen:** A review fires: ask_human shows front, SPOILER line, back, "grade 0-5". User answers 5 → "card 17, grade 5, next review in 3 days." Another card: grade 1 → "next review in 10 minutes." Fast-forward the `deck` view over two weeks: card 17's interval climbs 3 → 7.5 → 19 days; card 22 thrashes at ten-minute orbits, lapses ticking up. The due_at column scatters across the calendar.
**VO:** "Grade a card well — it recedes: three days, a week, three weeks. Blow one — it's back in ten minutes. Watch the deck over two weeks: the intervals fan out, card by card, into a calendar no human wrote. Five hundred cards, five hundred timelines, zero dollars while they wait — and a redeploy loses none of them."

## CTA (70-85s)

**Screen:** `curl .../stop` → "each card's pending review will stand down and unchain." Then README catalog, flashcard-coach row.
**VO:** "One flag stops all five hundred chains — coordination through state, no cancellation API. flashcard-coach, from oncell-cookbook. Build your deck, start it once, and let the runtime remember when you'll forget. Link below."
