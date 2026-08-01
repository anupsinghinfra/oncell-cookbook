---
title: A Thousand Users, a Thousand Timelines — Onboarding Without a Campaign Engine
description: Per-user onboarding sequences built from memory.forUser and self-scheduled wakes — with a zero-token kill switch the moment a user activates.
date: 2026-08-01
slug: onboarding-emailer
---

# A Thousand Users, a Thousand Timelines — Onboarding Without a Campaign Engine

You know the email. You'd been using the product daily for a week, and then: "Ready to take your first step? 🚀" Nothing says *we aren't paying attention* like onboarding mail sent to someone already onboarded — and it happens because most onboarding automation is a broadcast schedule wearing a personalization mask. The "sequence" is a campaign that fires day-2 mail at the day-2 cohort, and the activation check is a nightly sync that missed you.

Doing it *actually* per-user means every signup gets an independent timeline: their own next-touch timer, their own position in the sequence, their own stop condition. A thousand users, a thousand tiny state machines with day-scale timers. That's precisely the shape of system — long-lived, mostly idle, individually stateful — that traditional infrastructure makes miserable, which is why everyone rents a campaign engine and accepts the rocket-ship email.

`onboarding-emailer` builds the real thing in one file.

## A shelf per user

The per-user state costs one line of scoping, visible in the zero-LLM `activated` task in [`agent.js`](agent.js):

```js
const profile = agent.memory.forUser(userId); // keys become user:<id>:*
await profile.set("activated", true);
```

`memory.forUser` prefixes every key with `user:<id>:` transparently — no collisions, no WHERE clause, no schema. The identity declares the whole per-user shelf: `profile`, `step` (1–4), `activated`. And notice the handler has no `agent.llm` call at all: your product's activation webhook flips one durable key for zero tokens, in milliseconds.

## Each touch books the next — per user

The sequence itself is four steps of identity — welcome, best feature, customer story, check-in — with the gaps written into the wake procedure:

> "...send the next step email with send_email, write the new step, and call schedule with note set to touch <user_id> and in set to the gap before the following step - 2 days after step 1, 3 days after step 2, 4 days after step 3, nothing after step 4."

Every user's timeline is a chain of durable wake intents carrying their own id: `touch u_1042` fires in two days regardless of deploys, crashes, or how many other users signed up since. There is no cohort query, no campaign run at midnight — just each user's next touch, booked when their last one went out.

The stop conditions are checked *at wake time*, not at send-schedule time:

> "If activated is true or step is 4 or the profile is missing, answer that the sequence is over and send nothing."

So the race that produces the rocket-ship email can't happen. User activates on day 3? The day-5 wake still fires, reads `activated: true`, and stands down silently. Coordination through state — the same pattern as this cookbook's [`invoice-chaser`](../invoice-chaser/agent.js) — with no timers to cancel and no sync to miss. Step 4's rule ("This is the last email - the sequence ends here no matter what") is the anti-drip-hell clause: the sequence is finite by construction.

`send_email` is the single stub; point it at SES or Postmark. Budgets scale sanely: signup runs cap at `{ maxSteps: 10, maxCost: 0.25 }`, and the identity's `perDayCents: 300` handles hundreds of signups a day.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy onboarding-emailer
```

Wire two webhooks:

```bash
# on signup
curl -X POST https://api.oncell.ai/api/v1/agents/onboarding-emailer/signup \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "u_1042", "email": "sam@newco.example", "name": "Sam"}'

# on activation
curl -X POST .../onboarding-emailer/activated -d '{"user_id": "u_1042"}'
```

`progress` returns any user's `{ step, activated }` for zero tokens whenever support asks "what has this user been sent?"

## What you didn't have to build

A campaign engine and its segment queries. A per-user timer table with a scheduler polling it. An activation sync job and the race conditions it loses. Sequence-position tracking. A suppression list — suppression is just a key each wake reads. The runtime holds a thousand independent timelines at $0 while they wait.

You wrote four emails and their gaps. Every user gets their own clock, and the clock checks who they've become before it rings.
