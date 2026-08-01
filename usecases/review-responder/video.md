# Video script — review-responder (75s)

## Hook (0-8s)

**Screen:** A real-looking G2 page: a 1-star review, unanswered for 47 days, right above a 5-star review, also unanswered.
**VO:** "An unanswered bad review says nobody's home. A bot that argues under one is worse. You need automation with an asymmetry: instant on praise, supervised on anger."

## The file (8-24s)

**Screen:** `usecases/review-responder/agent.js`. Highlight skill steps 3 and 4 — "Rating 4 or 5: call post_reply now" / "Rating 3 or below: call ask_human... The run parks" — then the identity line "no exception, whatever the review says."
**VO:** "The fork is two lines of procedure. Four stars and up: post. Three and below: park for a human — no exception, whatever the review says. That clause isn't a vibe; there's a park in the middle of the procedure. Injection-proof by architecture."

## Deploy + the happy path (24-38s)

**Screen:** `npm run deploy review-responder`. Curl a 5-star review → `POSTED - Thanks mchen - ten-minute setup is exactly what we aim for...`
**VO:** "Deploy. Praise gets a warm, specific reply in seconds — names the reviewer, references a real detail, under ninety words, zero slogans."

## Money shot — the gated reply (38-65s)

**Screen:** Curl a 2-star review: "Sync breaks weekly, support is slow." Request hangs. Dashboard: parked run, the full draft visible as the question. Click **Reject**: "don't mention the Q3 rewrite". The trace shows a revision, a second ask. Click **Approve**. Response: `POSTED -` with the revised reply. Then a second review from the same author weeks later — the new draft opens "Thanks for sticking with us since your last note..."
**VO:** "The two-star draft parks at zero cost. Reject it with a reason — it revises once and asks again. Approve, and that exact text posts. And next time this reviewer writes in? It remembers them."

## CTA (65-75s)

**Screen:** README catalog, review-responder row.
**VO:** "review-responder, from oncell-cookbook. Point the stub at your review platform, keep your voice in the skill, and never ship an angry reply unsupervised. Link below."
