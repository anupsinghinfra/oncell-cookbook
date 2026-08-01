# Video script — news-briefing (75s)

## Hook (0-10s)

**Screen:** A newsletter with five sections; the reader scroll-skips three, every day, in time-lapse. Cut to two briefs side by side labeled "Day 1" and "Day 14" — same topics, visibly different proportions.
**VO:** "Your digest sends the same five sections forever. This one notices what you skip — and by day fourteen, the brief is shaped like you."

## The file (10-26s)

**Screen:** `usecases/news-briefing/agent.js`. Highlight the feedback loop — `updated[topic] * LIKE_FACTOR` / `* SKIP_FACTOR` with the clamps — then the identity line "a low weight shrinks a topic, it never silences it".
**VO:** "The preference-tuned cadence: the daily wake never changes — what changes is the state it reads. And look at the learning: two multiplications, clamped. Zero LLM. Your preference profile is one JSON key you can read and reset."

## Deploy + arm (26-38s)

**Screen:** `npm run deploy news-briefing`, `curl .../set-topics` with three topics — instant. `curl .../start -d '{}'` → `briefs/2026-08-01.md`: three equal sections. Dashboard: `brief · in 1 day`.
**VO:** "Declare your topics — free. Start arms the chain. Day one: three equal sections, weights all at one-point-oh."

## Money shot — the drift (38-65s)

**Screen:** `curl .../feedback -d '{"liked":["ai infrastructure"],"skipped":["kubernetes"]}'` → returns `{"ai infrastructure": 1.25, ..., "kubernetes": 0.8}` instantly. Repeat over a time-lapse of days; weights hit 2.4 and 0.2. Day 14 brief: "AI Infrastructure" leads with four items and a synthesis line; "Briefly: kubernetes —" one line at the bottom. Then a big k8s story breaks: it leads the brief anyway.
**VO:** "Each feedback call is a free state write — tomorrow's wake just reads new dials. Two weeks in, your favorite topic gets the ink and kubernetes shrinks to a heartbeat — never to zero, so it's still there the day it matters. And when it does matter? The editor rule overrides every dial."

## CTA (65-75s)

**Screen:** README catalog, news-briefing row.
**VO:** "news-briefing, from oncell-cookbook. Wire fetch_headlines to your news source, start it once, and steer it with your thumbs. Link below."
