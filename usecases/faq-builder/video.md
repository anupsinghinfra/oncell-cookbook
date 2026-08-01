# Video script — faq-builder (70s)

## Hook (0-8s)

**Screen:** A pristine FAQ page: "What makes your platform different?" Cut to a support inbox: "how do i cancel" ×9, phrased nine ways.
**VO:** "Your FAQ answers questions nobody asks. Your support inbox answers the real ones — forty times a week, then throws the answers away. Let's count instead of guess."

## The file (8-24s)

**Screen:** `usecases/faq-builder/agent.js`. Highlight the identity's clustering rule ("how do I cancel and where do I stop my subscription are the same question; how do I cancel and how do I pause are not"), then the `questions` table schema, then `model: "claude-haiku"` with `maxCost: 0.08`.
**VO:** "The hard part is knowing two phrasings are one question — that's judgment, so a cheap model applies it per transcript. Canonical question, variant count, and the best answer seen so far, accumulating in SQLite. Eight cents max per ticket."

## Deploy + ingest (24-42s)

**Screen:** `npm run deploy faq-builder`. Three ingest curls with differently-phrased cancel questions. Responses: `new how do I cancel my subscription`, `matched how do I cancel my subscription (now 2)`, `matched how do I cancel my subscription (now 3)`.
**VO:** "Three tickets, three phrasings, one cluster — and it shows you every decision it makes, so you can audit the judgment. Wire your helpdesk webhook at ingest and forget it."

## Money shot — the evidence-ranked FAQ (42-62s)

**Screen:** `curl .../top -d '{}'` → ranked rows: cancel (14), refunds (11), SSO setup (9)... Then `curl .../build -d '{}'` → `faq.md` scrolls: "Generated from 47 clustered questions", cancel question first, answer written from real support replies.
**VO:** "Weeks later: the ranking *is* the evidence. Build writes the FAQ — most-asked first, answers grown from your own team's best replies. And that top-questions list? That's your users telling you what the UI fails to explain."

## CTA (62-70s)

**Screen:** README catalog, faq-builder row.
**VO:** "faq-builder, from oncell-cookbook. Stop guessing what customers ask — they've been telling you all along. Link below."
