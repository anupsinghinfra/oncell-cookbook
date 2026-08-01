---
title: Inbox Triage for a Fraction of a Cent, with Skills Instead of Prompt Spaghetti
description: An email triager on claude-haiku that packages its rules as versioned skills and remembers every sender it has ever seen.
date: 2026-08-01
slug: inbox-triager
---

# Inbox Triage for a Fraction of a Cent, with Skills Instead of Prompt Spaghetti

Email triage is the classification task everyone builds twice. The first version is a prompt: "label this email as urgent, reply-needed, newsletter…" It works in the demo. Then reality arrives: the rules grow ("newsletters from the CEO are not newsletters"), the prompt swells past anyone's ability to review it, and — the killer — the classifier has no memory. It flags your co-founder's daily update as suspicious every single day, because every email is the first email it has ever seen.

`inbox-triager` fixes both failure modes with two runtime features: **skills** (procedures you version, not prompts you paste) and **durable memory** (a sender history that outlives every run). And because classification doesn't need a frontier model, it runs on `claude-haiku` with a $1/day ceiling — hundreds of emails a day, fractions of a cent each.

## Rules as a skill, not a blob

The classification procedure in [`agent.js`](agent.js) is a skill:

```js
const triageRules = skill("triage-rules", {
  description: "The classification procedure for one email - how to pick the label, the priority, and the suggested action.",
  instructions: "Triage procedure:\n1. Read sender:<address>:seen from memory ...",
  tools: [tools.memory],
});
```

Only that one-line description rides in the agent's base context; the six labels, the tie-breakers ("when torn between newsletter and notification, choose notification"), and the output contract load when triage work actually starts. When the rules change, you edit the skill and redeploy — the diff is reviewable, the version is tracked, and nothing else about the agent moves. A second skill, `rollup`, packages a different procedure over the same memory: top senders, label mix, and a watchlist. Same agent, two well-separated jobs.

Skills also scope tools: during triage the agent can touch memory and nothing else. A classifier physically can't do more than classify.

## A memory of every sender

The procedure's first step is the part your prompt-only classifier can't do:

> "Read sender:<address>:seen from memory; treat a missing value as zero. After deciding, write it back incremented and store the label under sender:<address>:last_label."

That history is durable KV, scoped to the agent, surviving restarts and redeploys. It changes classifications materially: "first-time sender asking for money" is spam; the colleague on their 40th email is not — even when both messages *say* the same thing. The identity encodes exactly that: "A first-time sender asking for money or credentials is a red flag; a colleague who writes every day is not."

The task handler adds one more memory trick worth knowing:

```js
await agent.memory.transact("triaged_total", "increment", 1);
```

`transact` is a serialized read-modify-write — when two emails land at the same moment, the counter still ends up correct. Concurrency safety as a one-liner.

## Cheap on purpose

```js
identity: {
  model: "claude-haiku", // classification does not need a frontier model
  budgets: { perDayCents: 100 },
}
```

and in the handler:

```js
const result = await agent.llm("Task: triage " + JSON.stringify({ from, subject, body: body.slice(0, 4000) }),
  { maxSteps: 8, maxCost: 0.05 });
```

The body is clipped — the subject and opening carry the signal — and each triage is hard-capped at 8 steps and five cents (in practice it costs a small fraction of that). The output contract is strict: `label | priority | action`, one line, no preamble. Strict formats are what make agents composable — the thing calling this agent can parse the answer with a `split("|")`.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy inbox-triager
```

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/inbox-triager/triage \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from": "billing@vendor.example", "subject": "Invoice overdue", "body": "Your invoice #1042 is 14 days overdue."}'
```

Back comes something like `urgent | p0 | Reply with payment confirmation or dispute the invoice`. Wire your mail provider's webhook at it, then ask for the weekly picture:

```bash
curl -X POST .../inbox-triager/rollup -d '{}'
```

## What you didn't have to build

A feature store for sender history. A prompt-versioning scheme held together with git blame. Rate-limiting and cost alarms for a high-volume classifier. Concurrency-safe counters. The runtime meters every call, enforces the daily dollar, and keeps the memory durable.

You wrote the rules — as a skill you can diff — and the agent got a memory for free.
