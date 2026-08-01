# Video script — onboarding-emailer (80s)

## Hook (0-10s)

**Screen:** An inbox: "Ready to take your first step? 🚀" — sent to a user whose dashboard behind it shows 9 days of activity.
**VO:** "Everyone's gotten this email — the welcome sequence that didn't notice you already onboarded. That's a campaign engine pretending to be personal. Here's actually personal."

## The file (10-26s)

**Screen:** `usecases/onboarding-emailer/agent.js`. Highlight the 4-step sequence in the identity, then `agent.memory.forUser(userId)` in the `activated` handler, then the wake rule "If activated is true... send nothing."
**VO:** "Four emails and their gaps, written as identity. Every user gets their own shelf of state — one line: memory dot forUser. And the stop condition is checked when each touch *fires*, not when it was scheduled."

## Deploy + signup (26-40s)

**Screen:** `npm run deploy onboarding-emailer`. Curl `signup` for u_1042 → `started u_1042 at step 1, next touch in 2 days`. Dashboard: wake intent `touch u_1042 · in 2 days`. Curl two more signups — three independent wake entries.
**VO:** "Every signup starts its own timeline. Three users, three independent clocks in the runtime's ledger — not one campaign firing at cohorts."

## Money shot — the race that can't happen (40-68s)

**Screen:** Day 3: curl `activated` for u_1042 → instant response, trace shows **no LLM call**, just one memory write. Day 5: the `touch u_1042` wake fires — trace: read `user:u_1042:activated = true` → "sequence is over", no email. Meanwhile u_1043's wake, same minute, sends step 2 normally.
**VO:** "User activates — one zero-token webhook flips their key. Two days later their scheduled touch still fires... reads the key... and stands down. No cancelled timers, no nightly sync to miss. The neighbor who didn't activate gets their email in the same minute."

## CTA (68-80s)

**Screen:** README catalog, onboarding-emailer row.
**VO:** "onboarding-emailer, from oncell-cookbook. Two webhooks, four emails, a thousand timelines — and nobody ever gets the rocket-ship email again. Link below."
