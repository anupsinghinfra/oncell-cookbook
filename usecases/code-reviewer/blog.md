---
title: A Code Reviewer with a Real Shell — Evidence, Not Vibes
description: Paste a diff, get a senior-engineer review produced inside a gVisor sandbox where the agent runs grep on the patch instead of guessing.
date: 2026-08-01
slug: code-reviewer
---

# A Code Reviewer with a Real Shell — Evidence, Not Vibes

LLM code review has a credibility problem, and it isn't the model. It's that most review bots are *read-only*: the diff goes into the context window, prose comes out, and every claim in between is unverified. The bot says "this regex is never anchored" — did it check, or does that sentence just have high probability? You can't tell, so you stop reading its comments, and then it's noise with a subscription fee.

Human reviewers earn trust differently: they open the file, grep for other call sites, count what changed. The difference between a review and a vibe is *evidence* — and evidence requires the ability to run things.

`code-reviewer` runs things. It executes inside a gVisor sandbox with a working shell (and no network), so the review loop can interrogate the patch instead of hallucinating about it.

## Commands, not vibes

The identity instructions in [`agent.js`](agent.js) make the method explicit:

> "Save it to your workspace with shell (a heredoc into patch.diff), then gather evidence with commands, not vibes: count added lines with grep -c on lines starting with +, list touched files from the +++ headers, re-read any hunk you doubt. The sandbox has no network - commands are for analysis, not installation."

Two capabilities make that sentence real:

```js
capabilities: [tools.files, tools.shell],
```

`shell` executes inside the sandbox — isolated by gVisor, watched by the supervisor, incapable of reaching the internet. That last property matters more for a code reviewer than for almost any other agent: the input is *hostile by definition*. A diff can contain anything, including text engineered to talk an agent into exfiltrating it. Here, there is nowhere to exfiltrate to. The sandbox has no network; the worst a malicious patch can do is waste some of the run's step budget.

## An archive of every verdict

`files` is the agent's durable filesystem, and the task handler uses it before the model thinks at all:

```js
const stamp = new Date().toISOString().slice(0, 10);
const slugged = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
await agent.files.write("reviews/inbox/" + stamp + "-" + slugged + ".diff", diff);
```

Every patch that ever arrives is archived under `reviews/inbox/`, and the identity requires the finished review to be written to `reviews/latest.md` before answering. Six months from now you can ask what was reviewed, when, and what the verdict was — the agent's filesystem *is* the audit trail, synced to S3 by the runtime without a line of your code.

## A hard ceiling on a hostile input

```js
const result = await agent.llm(
  "Task: review " + JSON.stringify({ title }) + "\n\n```diff\n" + diff + "\n```",
  { maxSteps: 20, maxCost: 0.75 },
);
```

One managed loop — think, run a command, look, repeat — capped at 20 steps and 75 cents *no matter what the diff contains*. A pathological patch can't spin the reviewer forever; the loop returns with `status: "max_steps"` instead, and the daily identity budget (`perDayCents: 300`) backstops everything at $3/day. The output contract is fixed too: a verdict line — `APPROVE`, `APPROVE WITH NITS`, or `REQUEST CHANGES` — findings ordered by severity with file and line, then nits, under 400 words. Parseable enough to gate CI on the first line.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy code-reviewer
```

Review a real change straight from your repo:

```bash
git diff main | jq -Rs '{title: "my branch", diff: .}' | \
curl -X POST https://api.oncell.ai/api/v1/agents/code-reviewer/review \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" -d @-
```

Or start with the built-in smoke test — a one-line off-by-one fix — via `npm run smoke code-reviewer`, and watch it come back `APPROVE` with a correct explanation of why `Math.ceil` is right for page counts.

## What you didn't have to build

A sandbox with syscall isolation. Network egress controls for hostile inputs. An artifact store for diffs and verdicts. Step and cost circuit-breakers. A trace of every command the reviewer ran — the run log records each `shell` call and its output, so you can audit the *review* the way the review audits the code.

You wrote review values and an output format. The runtime brought the shell, the walls, and the meter.
