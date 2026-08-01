---
title: One Run, Five Days, Zero Dollars Idle — Scheduling a Meeting by Email
description: A negotiation agent that proposes times, parks at $0 while waiting for replies, and resumes mid-conversation — no state machine, no workflow engine.
date: 2026-08-01
slug: meeting-scheduler
---

# One Run, Five Days, Zero Dollars Idle — Scheduling a Meeting by Email

Booking a meeting with someone outside your company is the world's most familiar distributed-systems problem. You propose Tuesday or Wednesday. They reply Thursday — two days later — with "Thursday?" You check the calendar, counter with Friday morning. They accept on Monday. Total human effort: maybe six sentences. Total elapsed time: five days. It's exactly the workload assistants used to absorb, which is why "AI scheduling assistant" is a graveyard genre: the *language* was never the hard part. The hard part is being a process that stays coherent across five days of silence without costing anything or forgetting anything.

Write it as normal software and you get the dreaded shape: a state machine (PROPOSED → COUNTERED → CONFIRMED), a table to persist it, webhook handlers to advance it, and glue to rebuild context on every event. The conversation logic — the *easy* part — ends up smeared across four files.

`meeting-scheduler` is the other shape: the whole negotiation is **one run** that parks.

## Park, don't persist

The core loop, straight from the identity in [`agent.js`](agent.js):

> "After every email you send, call ask_human with the question reply from <with>? - paste their response, or answer reject to abandon. The run parks at zero cost until the organizer relays the reply."

Propose → park → read the reply → counter → park again. Each `ask_human` call snapshots the run and drops compute to $0; the counterpart's two-day silence costs exactly nothing. When you paste their reply into the dashboard, the run resumes *mid-negotiation*, with every prior round still in context — no rehydration code, because nothing was ever torn down from the program's point of view. Crashes and redeploys during a park are invisible; that's the runtime's contract, the same one behind this cookbook's [`expense-approver`](../expense-approver/agent.js), stretched from one approval to a week-long conversation.

The `ask_human`-as-relay pattern is worth naming: the human here isn't an approver, they're a *transport* — forwarding the outside world into a parked run. Until you wire inbound email directly, the organizer pastes replies; the agent does everything else.

## Grounded proposals, bounded patience

Two stubs anchor the negotiation to reality. `check_calendar` returns the organizer's actual free slots, and the identity forbids inventing others: "propose only slots it returned" — no AI-assistant classic of confidently offering a time you don't have. `send_email` carries the proposals: "short, warm, and always containing 2 or 3 concrete options with day, date, time, and timezone."

Patience is bounded too: after 4 rounds it stops, suggests the counterpart send availability instead, and marks the negotiation `abandoned` — governed by the loop caps in the handler:

```js
const result = await agent.llm(
  "Task: schedule-meeting " + JSON.stringify({ meeting_id: meetingId, with: counterpart, topic, duration_min: duration }),
  { maxSteps: 30, maxCost: 1.0 },
);
```

Thirty steps sounds like a lot until you remember each round is propose-park-read-counter; a dollar cap covers the longest civil negotiation. State lands in `meeting:<meeting_id>` memory after every round, so the zero-token `negotiations` task can always show you where each thread stands.

One honest note: this agent's `smokeTask` is `null` in the catalog — every invocation parks on a human, which is the whole point, but it means there's no cheap automated smoke test. Deploy it and schedule something real.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy meeting-scheduler
```

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/meeting-scheduler/schedule-meeting \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"meeting_id": "m-podcast", "with": "jordan@guestco.example", "topic": "podcast recording", "duration_min": 45}'
```

The first proposal email goes out and the run parks. Each time Jordan replies, paste it into the dashboard question and watch the next round go out. Days later the curl returns: `BOOKED Fri 2026-08-07 09:30-10:15 PT`.

## What you didn't have to build

A negotiation state machine and its table. Webhook plumbing to advance it. Context rehydration after every event. Idle-time compute costs — five days of waiting bills as zero. Crash recovery mid-thread. The run log *is* the negotiation history, every email and every reply in order.

You wrote the etiquette of scheduling in one paragraph. The runtime supplied the patience.
