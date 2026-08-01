# Video script — cert-expiry-sentinel (75s)

## Hook (0-10s)

**Screen:** A browser showing NET::ERR_CERT_DATE_INVALID on a production domain, Saturday 2:14 AM. Cut to a calm Slack message from three weeks earlier: "notice: api.myapp.example expires 2026-11-15 (30 days)".
**VO:** "Certs don't fail suddenly. They fail on a date you knew months in advance. This agent turns that date into three perfectly-timed wakes."

## The file (10-25s)

**Screen:** `usecases/cert-expiry-sentinel/agent.js`. Highlight the countdown sentence in the identity ("the next threshold instant ... call schedule with at set to that exact ISO timestamp"), then `capabilities: [tools.db, tools.memory, tools.schedule, sendAlert]`.
**VO:** "This is the deadline-countdown pattern: not a daily poll asking 'is anything due?' — the agent computes expiry minus 30, 7, and 1 days and books wakes at those exact instants."

## Deploy + arm (25-38s)

**Screen:** `npm run deploy cert-expiry-sentinel`, then `curl .../add-cert` twice — instant zero-token responses — then `curl .../start -d '{}'`. Dashboard shows pending wakes: `scan · in 7 days`, `check api.myapp.example · at Oct 16 00:00`.
**VO:** "Adding certs is a SQLite insert — no tokens. One start call arms it: a weekly surveyor scan, plus a stake planted at the precise 30-day mark."

## Money shot — the renewal (38-65s)

**Screen:** The `check` wake fires → one `notice` alert. Then `curl .../renewed` with a new expiry date. The old 7-day wake fires anyway — trace shows it re-reading the row, computing 340 days left, answering "stood down", sending nothing.
**VO:** "Thirty days out: one alert. Then you renew — a zero-token row update. The old wake still fires... reads the new date... and stands down silently. You never cancel scheduled work. You change the state it reads when it wakes."

## CTA (65-75s)

**Screen:** README catalog, cert-expiry-sentinel row.
**VO:** "cert-expiry-sentinel, from oncell-cookbook. Point send_alert at your pager, load your certs, arm it once. Link below."
