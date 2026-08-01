# Video script — crm-touch-cadence (70s)

## Hook (0-10s)

**Screen:** A phone: 14 snoozed reminders — "ping Dana", "email Marcus (3rd snooze)". Cut to a clean morning digest: three names, each with two sentences ready to send.
**VO:** "You don't need fourteen reminders. You need three names a day, chosen this morning, with the message already drafted."

## The file (10-25s)

**Screen:** `usecases/crm-touch-cadence/agent.js`. Highlight the decay formula ("days since last_touch multiplied by importance"), the 7-day no-renag rule, and "schedule with in set to 1 day and note set to cadence".
**VO:** "The pattern is decay scoring at wake. No per-person timers anywhere — one daily wake recomputes the whole leaderboard from the clock and picks the top three. Nothing booked per contact means nothing to cancel, ever."

## Deploy + load (25-38s)

**Screen:** `npm run deploy crm-touch-cadence`, then `curl .../add-contact` ×4 scrolling — instant, zero tokens. `curl .../coldest` shows a ranked leaderboard. Then `curl .../start -d '{}'`.
**VO:** "Your network loads as free SQLite upserts. The leaderboard is a SQL read — also free. Start arms the morning."

## Money shot — the clock resets (38-62s)

**Screen:** Morning digest arrives: "Dana Reyes — 87 days, importance 3. Opener: ..." User sends the email, then `curl .../touched -d '{"name":"Dana Reyes"}'`. Re-run `coldest`: Dana drops from #1 to the bottom; a new name floats up. Next morning's digest: three different people.
**VO:** "Dana tops the list at 87 days. You send the note, log the touch — one free call — and she falls off the board. Tomorrow the wake reads the clock again and three new people surface. The system stays honest because resetting it costs nothing."

## CTA (62-70s)

**Screen:** README catalog, crm-touch-cadence row.
**VO:** "crm-touch-cadence, from oncell-cookbook. Wire the digest to your inbox, load your people, start it once. Nobody goes quietly cold again. Link below."
