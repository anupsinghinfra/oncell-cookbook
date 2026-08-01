---
title: From Commit Log to Customer Story, with Evidence
description: A release-notes agent that greps the log before writing a word, applies a versioned house style, and archives every release it ever announced.
date: 2026-08-01
slug: release-notes-writer
---

# From Commit Log to Customer Story, with Evidence

"fix: race in token refresh (again)" is a perfectly good commit message and a terrible sentence to show a customer. Between every release and its announcement sits a translation job nobody owns: turn forty commits of engineer-speak into two hundred words of *what this means for you*. So release notes get written at 6pm by whoever cut the release, in whatever style they improvised, leaking whatever the log happened to contain — internal ticket IDs, self-deprecating root causes, the occasional `chore: bump deps` presented as news.

The failure isn't writing ability; it's that the job has two halves that pull apart. Half one is *accounting*: what actually shipped — how many features, how many fixes, is anything uncategorized? Half two is *storytelling*: benefits, reassurance, and a consistent voice. Humans skip the accounting when tired. Chatbots skip it always — paste a log into a prompt window and the summary will cheerfully describe commits that aren't there.

`release-notes-writer` does the accounting with a real shell, and the storytelling with a versioned skill.

## Count first, write second

The task handler in [`agent.js`](agent.js) saves the log to the agent's filesystem *before* the model thinks:

```js
await agent.files.write("worklog/commits.txt", commits);
```

Then the identity mandates the survey:

> "Survey before writing: use shell against worklog/commits.txt to count commits (wc -l), count each conventional type (grep -c on feat:, fix:, perf:, chore:), and list anything unprefixed. Ground the notes in what you counted - never claim more changes than the log contains."

Those `grep -c` calls execute in the gVisor sandbox and land in the run trace, so "3 new features" in the notes is checkable against a counted `3`. It's the same evidence-not-vibes discipline as this cookbook's [`code-reviewer`](../code-reviewer/agent.js), pointed at marketing instead of review.

## The style is a diffable artifact

Everything editorial lives in the `house-style` skill: benefit-first bullets ("Rewrite feat: add bulk CSV export as Export your entire workspace to CSV in one click"), fixes as reassurance without root-cause confession, a hard hide-list (chores, dep bumps, refactors, CI), under 250 words, no exclamation marks. Even the empty case is designed: if hiding the plumbing leaves nothing, the notes say "this release focuses on stability behind the scenes" — which beats inventing perceivable changes, the classic LLM failure under pressure to produce.

When marketing wants a new tone, they edit the skill and redeploy; the git diff is the style-guide change request, reviewable like any code. While the skill is active, tools narrow to `files` and `shell` — read the log, write the notes, nothing else.

Each release lands at `release-notes/<version>.md` on the durable filesystem, next to the raw `worklog/commits.txt` it came from, and `changelog {}` lists every release ever announced for zero tokens.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy release-notes-writer
```

Pipe a real log straight from git:

```bash
git log --oneline --pretty=format:%s v2.13.0..HEAD | \
  jq -Rs '{version: "v2.14.0", commits: .}' | \
curl -X POST https://api.oncell.ai/api/v1/agents/release-notes-writer/write \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" -d @-
```

Back come the finished notes — summary line, New, Improved, Fixed — with the `chore:` commits nowhere in sight, and the same text archived under `release-notes/v2.14.0.md`. Wire it into your release pipeline and the announcement drafts itself the moment the tag exists.

## What you didn't have to build

A sandbox where an agent can safely run shell commands over pasted input. An artifact store for logs and notes. A style guide that people actually follow — the skill applies it identically at every release, including the 6pm ones. Cost ceilings for the day someone replays the whole tag history — 14 steps and fifty cents per run, $2/day total, runtime-enforced.

You wrote the house style once and the translation job stopped having an owner. The log goes in; the story comes out; the evidence is in the trace.
