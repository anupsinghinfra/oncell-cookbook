---
title: An Expense Approver that Waits Days for a Human — at $0/hour
description: Auto-approve the small stuff, park on the big stuff. Crash-proof human-in-the-loop without a queue, a worker, or a state machine.
date: 2026-08-01
slug: expense-approver
---

# An Expense Approver that Waits Days for a Human — at $0/hour

Expense approval is the perfect job for an agent, and the perfect trap. Perfect job: 90% of requests are a $14 lunch or a $30 domain renewal — obvious, policy-clear, and currently interrupting a manager anyway. Perfect trap: the other 10% *must* wait for a human, and "an AI process that waits for a human" is where agent architectures go to die.

Think about what waiting actually requires. The agent has decided this $240 conference ticket needs sign-off. Now it must ask someone, then... exist, somehow, until Tuesday when the manager gets back. Keep a process alive for four days? You're paying for idle compute and praying against restarts. Persist and rebuild state yourself? Congratulations, you're writing a workflow engine — queue, callbacks, timeout handling, replay, and a bug tracker full of "approval fired twice."

`expense-approver` does it in one file, because parking is a runtime primitive, not your problem.

## The policy is the identity

The identity instructions in [`agent.js`](agent.js) carry the whole policy: under $50 with a clear purpose, approve on the spot; $50 or more, unclear, or duplicate-looking — escalate and wait. Every decision lands in a SQLite `decisions` table the agent creates itself, so there's a paper trail from day one.

And spend control isn't in the prompt — it's in who the agent is:

```js
identity: {
  instructions: IDENTITY_INSTRUCTIONS,
  model: "claude-sonnet",
  budgets: { perDayCents: 200 },
}
```

`perDayCents` goes into the deploy manifest and is enforced by the runtime at the metering boundary. An agent that approves money for a living should have a hard ceiling on the money it burns doing so — one it cannot prompt-inject its way past.

## The escalation skill: pause as a procedure

```js
const escalation = skill("escalation", {
  description: "Escalate an expense to a human approver and wait for the decision - required at $50 and above or when anything is unclear.",
  instructions: "Escalation procedure:\n1. Summarize the expense in one line ...",
  tools: [tools.ask_human, tools.db],
});
```

While this skill is active, the agent's tools narrow to exactly two: `ask_human` and `db`. It can pause for a person and write the paper trail — nothing else. That's least-privilege as a one-line declaration.

Step 2 of the procedure is where the runtime earns its keep: "Call ask_human with exactly that line as the question. The run parks here at zero compute cost." Under the hood, the `ask_human` tool hands the question to the approvals machinery and *parks the run*: state snapshotted, sandbox torn down, $0/hour, question sitting in the dashboard. When the human answers — in a minute or in four days — the run resumes on the next line of the procedure, on whatever host is alive, records the outcome, and answers the requester. A crash, a deploy, a host replacement in between: invisible. Completed LLM calls are never re-paid on replay.

Step 4 is worth stealing for your own agents: "Never ask twice for the same expense - if a matching decision row already exists, report that outcome instead." Idempotency, written as policy rather than plumbing.

## The task handler

```js
agent.task("approve-expense", async (args) => {
  const amount = Number(args.amount_usd);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("approve-expense requires a positive { amount_usd }");
  }
  ...
  const result = await agent.llm("Task: approve-expense " + JSON.stringify({ ... }),
    { maxSteps: 10, maxCost: 0.3 });
```

Garbage is rejected before a token is spent; then one managed loop applies the policy. Small expenses finish in a couple of steps. Big ones disappear into the park and come back approved or rejected — same invocation, wildly different lifetimes, identical code.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy expense-approver
```

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/expense-approver/approve-expense \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requester": "dana", "amount_usd": 240, "description": "Conference ticket"}'
```

Send a $12 coffee first and get `APPROVED - ...` back in seconds. Then send the $240 ticket, watch the run park in your dashboard, and answer it whenever you like.

## What you didn't have to build

A workflow engine. A queue with visibility timeouts. A notification channel with resume tokens. Crash recovery for in-flight approvals. Duplicate suppression. Cost caps. An audit log — the run log already records the question, the wait, and the human's answer.

You wrote a policy and a table schema, in English. The runtime does the waiting.
