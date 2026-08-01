# Video script — expense-approver (80s)

## Hook (0-8s)

**Screen:** A Slack DM pile: "can you approve my expense?" ×6. Then a terminal cursor.
**VO:** "Ninety percent of expense approvals are a fourteen-dollar lunch. The other ten percent need a human — and that's the part that kills every automation. Watch an agent wait four days for a manager... for free."

## The file (8-24s)

**Screen:** `usecases/expense-approver/agent.js`. Highlight the policy lines in the identity, then `budgets: { perDayCents: 200 }`, then the `escalation` skill with `tools: [tools.ask_human, tools.db]`.
**VO:** "The policy lives in the identity: under fifty dollars, approve; over, escalate. The budget lives there too — two dollars a day, enforced by the runtime, not the prompt. And the escalation skill narrows the agent's hands to exactly two tools: ask a human, write the record."

## Deploy + the easy case (24-40s)

**Screen:** `npm run deploy expense-approver`. Then curl with `{"requester":"sam","amount_usd":12.5,"description":"Team coffee"}` → response line `APPROVED - small clear business expense`.
**VO:** "Deploy. The twelve-dollar coffee? Approved in seconds, logged in SQLite."

## Money shot — the park (40-68s)

**Screen:** Curl with `{"amount_usd": 240, "description": "Conference ticket"}` — the request visibly hangs. Cut to dashboard: parked run, question "dana: $240, conference ticket. Approve?", status **parked · $0/hr**. On-screen timer jumps "2 days later". Click Approve with reason "budget ok". The response arrives: `APPROVED - approved by manager: budget ok`.
**VO:** "Two hundred forty dollars? The run parks. Not polling, not a queue — a snapshot. Zero compute while it waits. Two days later a human clicks approve, and the run resumes mid-procedure — even if we redeployed twice in between. The decision lands in the table with the reason."

## CTA (68-80s)

**Screen:** README catalog, expense-approver row.
**VO:** "expense-approver, from oncell-cookbook. Human-in-the-loop without a workflow engine. Clone, add your key, one command. Link below."
