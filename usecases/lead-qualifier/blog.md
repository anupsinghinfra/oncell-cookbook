---
title: Lead Scoring Where Humans Only See the Borderline
description: An ICP rubric packaged as a versioned skill, instant verdicts on obvious leads, and a $0 park for sales judgment on the genuinely unclear.
date: 2026-08-01
slug: lead-qualifier
---

# Lead Scoring Where Humans Only See the Borderline

Ask a sales team what happens to inbound leads and you'll hear one of two confessions. Either every form fill pings a human — and your AE spends mornings disqualifying students and competitors doing recon — or a lead-scoring model silently routes everything, and nobody can explain why the 800-vehicle fleet operator got filed under "nurture." Full-manual wastes your best people on the obvious; full-auto makes your most important calls with no judgment in the loop.

The right split is old operational wisdom: automate the clear cases, escalate the ambiguous ones. What made it hard to *implement* is the escalation — "hold this lead until a salesperson decides" means a queue, a notification, a resume path, and a process that waits without burning anything. That's the infrastructure that never gets built, so teams collapse back to one of the two bad extremes.

`lead-qualifier` implements the split in one file, because holding-until-a-human-decides is a runtime primitive.

## The ICP is a skill, not a vibe

The scoring criteria in [`agent.js`](agent.js) live in a skill called `icp-rubric` — points for company fit, buyer fit, and intent, summing to a 0–100 score:

```js
const icpRubric = skill("icp-rubric", {
  description: "Score one inbound lead 0-100 against the ideal customer profile and decide qualified, disqualified, or escalate to a human.",
  instructions: "Scoring rubric - start at 0, add points for each signal:\n- Company fit (0-40): ...",
  tools: [tools.db, tools.ask_human],
});
```

Three properties fall out of that declaration. The rubric is *versioned* — when your ICP shifts upmarket, you edit point values and redeploy, and the git diff is your scoring changelog. It's *lazy* — only the one-line description rides in base context; the full rubric loads when a lead actually arrives. And it's *scoped* — while scoring, the agent's tools narrow to `db` and `ask_human`: record and (rarely) ask, nothing else.

## Three bands, one park

The verdict bands are where the runtime earns its place:

> "70 to 100: QUALIFIED. 0 to 40: DISQUALIFIED. 41 to 69: borderline - call ask_human with one line stating the score and the tension (for example strong intent but tiny fleet)."

A clear fit or clear miss finishes in a few steps and answers immediately. A 55 hits `ask_human` and the run *parks*: snapshotted, $0/hour, a one-line question sitting in the dashboard — "55: strong intent but tiny fleet. Qualify?" — until someone on sales clicks. Then the run resumes mid-procedure, records the human's reason, and answers. Same task, same code path, wildly different lifetimes. The human sees only the leads where their judgment actually changes the outcome.

Every verdict — instant or escalated — lands in the `leads` SQLite table with score, verdict, and reason, and the identity adds an idempotency rule worth stealing: "Never score the same email twice: if a lead row with this email already exists, answer with the existing verdict instead of re-scoring." Your form's double-submit bug just stopped mattering.

The output contract is one parseable line — `QUALIFIED - 85 - VP Ops at an 800-vehicle logistics company asking about API pricing` — so your CRM webhook can route on the first word.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy lead-qualifier
```

Point your form handler at it:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/lead-qualifier/qualify \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Priya N", "company": "Meridian Logistics", "email": "priya@meridian.example", "notes": "VP Ops, 800-person fleet, asked about API pricing"}'
```

That one comes back `QUALIFIED` in seconds. Send a mid-market maybe and watch the run park in your dashboard instead — answer it after lunch; the requester gets their verdict the moment you click. `pipeline {}` prints the running picture in three sections whenever you want it.

## What you didn't have to build

A rules engine and the admin UI to edit it. An escalation queue with notifications and resume tokens. A worker that holds borderline leads without holding compute. Dedup for double-submitted forms. An audit table — `leads` *is* the audit table, and the run log shows the rubric math behind every score.

You wrote your ICP as a rubric and drew two lines at 40 and 70. The runtime handles everything between them.
