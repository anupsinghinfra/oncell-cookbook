# Video script — meeting-prep-briefer (70s)

## Hook (0-10s)

**Screen:** A calendar notification: "Northwind renewal sync — in 5 minutes." Frantic tab-opening: LinkedIn, old email threads. Cut to a clean one-pager: meeting purpose, two attendee lines, a suggested opening question.
**VO:** "Walking in cold is a tax you pay every day. Executive assistants fixed this decades ago. Now it's one file and one command."

## The file (10-25s)

**Screen:** `usecases/meeting-prep-briefer/agent.js`. Highlight the weekday arithmetic in the identity ("if that lands on Saturday add two more...") and "call schedule with at set to the computed next weekday 06:30:00Z instant".
**VO:** "The pattern here is weekday-only self-rebooking. No cron syntax — the agent computes its own next wake as an absolute timestamp and books it. The weekend logic is a sentence in English."

## Deploy + feed (25-38s)

**Screen:** `npm run deploy meeting-prep-briefer`, then `curl .../add-context` with a note about Dana Reyes — instant, zero tokens. Then `curl .../start -d '{}'`.
**VO:** "People notes go in as free memory writes — no model in the loop. One start call arms the chain."

## Money shot — Friday books Monday (38-62s)

**Screen:** Friday's run log: `3 meetings briefed, next wake 2026-08-03T06:30:00Z` — calendar overlay shows that's Monday. Dashboard all weekend: one pending wake, $0.00. Monday 06:30: `briefs/2026-08-03.md` appears; the Dana line carries the context note added weeks earlier.
**VO:** "Watch the Friday run: next wake — Monday, six-thirty. It skipped the weekend because it computed the skip. Monday morning the brief is waiting, and Dana's line remembers what you told it in July."

## CTA (62-70s)

**Screen:** README catalog, meeting-prep-briefer row.
**VO:** "meeting-prep-briefer, from oncell-cookbook. Wire fetch_calendar to your calendar, feed it people, never walk in cold again. Link below."
