# Video script — invoice-chaser (80s)

## Hook (0-8s)

**Screen:** A spreadsheet tab named "AR chasing — FINAL(2)", rows highlighted in red. Cut to a terminal: `chasing INV-2041, next nudge in 7 days`.
**VO:** "Chasing invoices is a script humans keep running by hand — because software that does a tiny thing, then waits a week, is weirdly hard to build. Not anymore."

## The file (8-24s)

**Screen:** `usecases/invoice-chaser/agent.js`. Highlight the tone-ladder lines in the identity, then "call schedule with in set to 7 days and note set to nudge <invoice_ref>", then `capabilities: [tools.db, tools.schedule, tools.ask_human, sendEmail]`.
**VO:** "The escalation ladder is three sentences: warm, firm, final. Every nudge ends by booking the next one — a durable wake intent in the runtime, not a timer in a process. And after three emails, it must ask a human."

## Deploy + chase (24-38s)

**Screen:** `npm run deploy invoice-chaser`, then the chase curl. Dashboard shows a scheduled wake: `nudge INV-2041 · in 7 days`.
**VO:** "Deploy, hand it an invoice. First warm email goes out, and the next wake is already booked. Between nudges this agent costs exactly zero."

## Money shot — the stand-down (38-65s)

**Screen:** `curl .../payment-received -d '{"invoice_ref":"INV-2041"}'` → "Marked INV-2041 paid. The scheduled nudge will stand down when it wakes." Time-skip to the wake firing; trace shows: read row → status paid → "chase is over", no email sent.
**VO:** "Payment lands. One zero-token task flips the row — no LLM, no timer cancellation. Next week the wake still fires, reads *paid*, and quietly stands down. Coordination through state. No race, no double-send, no apology email to a customer who already paid."

## CTA (65-80s)

**Screen:** README catalog, invoice-chaser row; then the `status` task returning the ledger.
**VO:** "invoice-chaser, from oncell-cookbook. Polite, relentless, two dollars a day, and it never threatens collections without you. Clone, deploy, close the spreadsheet. Link below."
