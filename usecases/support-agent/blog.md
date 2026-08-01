---
title: A Support Agent that Remembers Every Customer — and Can't Refund a Cent Alone
description: Build a production support agent with per-user memory and a human-gated refunds skill, deployed in one command on OnCell.
date: 2026-08-01
slug: support-agent
---

# A Support Agent that Remembers Every Customer — and Can't Refund a Cent Alone

Every support bot demo has the same two failure modes waiting behind the confetti. The first: it greets your best customer — third order this quarter, one open exchange — like a total stranger, because the "conversation history" lived in a context window that evaporated when the tab closed. The second is worse: someone discovers that if you ask nicely enough, the bot will refund things. Bots that can move money and bots that follow policy have historically been different bots.

The fix for the first problem is durable, per-customer state. The fix for the second is a hard rule: money never moves without a human in the loop. Both are miserable to build yourself — a user-keyed datastore, an approval queue, a worker that can wait days for an approver without burning compute or losing its place when you redeploy. That's a quarter of infrastructure before your agent says hello.

`support-agent` is 100 lines. The runtime does the rest.

## Memory with a shelf per customer

The chat handler in [`agent.js`](agent.js) opens with one line that replaces the user-keyed datastore:

```js
const profile = agent.memory.forUser(userId); // every key below is really user:<id>:<key>
const known = (await profile.get("summary")) ?? "New customer - no history yet.";
```

`memory.forUser(id)` returns the same memory interface, scoped: every `get`, `set`, and `append` is transparently prefixed `user:<id>:`. No collisions, no WHERE clauses, no schema. After the reply, the handler folds the exchange into a rolling summary:

```js
await profile.set("summary", (known + "\n" + result.text).slice(-2000));
```

Next week, when the same customer writes in, the loop starts with everything worth knowing about them already in the prompt. The memory is NVMe-fast, S3-durable, and survives redeploys — because it belongs to the runtime, not the process.

## The refunds skill: policy with teeth

The identity says: "The moment money must move, activate the refunds skill and follow it exactly." A skill is a prompt for specific work *plus the tools it uses*:

```js
const refunds = skill("refunds", {
  description: "Handle refund and return requests under Acme policy - money never moves without human approval.",
  instructions: "Refund procedure - follow every step, in order:\n1. Look up the order ...",
  tools: [lookupOrder, issueRefund, tools.ask_human, tools.memory],
});
```

Two things happen here that a system prompt can't do. First, context engineering: only that one-line description rides in the agent's base context; the full procedure loads when refund work actually starts, so the window stays small as the agent's expertise grows. Second, tool scoping: while the skill is active, the agent's hands are *only* the refund tools plus `ask_human`. Least privilege, expressed in your own vocabulary — no policy engine in sight.

Step 3 of the procedure is the teeth: "Call ask_human with that line - the run parks at zero cost until an approver answers." When the model calls `ask_human`, the runtime parks the run — snapshots it, drops compute to $0, and waits. Hours, days, across crashes and deploys. When an approver clicks yes, the run resumes mid-procedure and calls `issue_refund`. You wrote none of that machinery.

`lookup_order` and `issue_refund` are custom tools — same shape as prebuilt ones, `params` is the JSON schema the model sees, and the `run` bodies are clearly marked stubs you point at your order system and payments provider. They live in source; the manifest only ever carries prebuilt capability names.

## Identity is also a budget

```js
identity: {
  instructions: IDENTITY_INSTRUCTIONS,
  model: "claude-sonnet",
  budgets: { perDayCents: 500 },
}
```

What an agent may spend is part of who it is. The $5/day ceiling is enforced by the runtime at the metering boundary — not by a `if (cost > 5)` you hope executes.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy support-agent
```

Then talk to it:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/support-agent/chat \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Where is my order AC-1042?"}'
```

Ask for a refund and watch the run park in your dashboard, waiting for your approval. Approve it, and the run wakes up exactly where it left off.

## What you didn't have to build

A per-customer database. A conversation summarizer pipeline. An approval queue with delivery, timeouts, and resume logic. A worker that survives deploys mid-refund. Spend caps. Audit trails — the run log records every tool call, including the human's answer.

One file, one manifest, one command. That's the whole point.
