---
title: One Post In, Three Channels Out — Without Losing Your Voice
description: A repurposing agent whose house voice is a versioned skill, with every derivative archived to a durable content library.
date: 2026-08-01
slug: content-repurposer
---

# One Post In, Three Channels Out — Without Losing Your Voice

Here's the content marketing math nobody likes: the blog post took you six hours, and the derivatives — the thread, the LinkedIn version, the newsletter blurb — take another ninety minutes each time, forever. So you paste the post into a chat window with "make this a thread," and what comes back is competent, generic, and unmistakably not you. Hashtags you'd never use. A "🧵" you'll have to delete. An opening line that defines the topic like an encyclopedia instead of leading with the thing that made the post worth writing.

The problem isn't the model. It's that your voice lives in your head and gets re-explained — partially, differently — every single time. Prompt-window repurposing has no memory of the rules and no archive of the outputs. Twice the same post gets repurposed two different ways, and last month's thread is in someone's clipboard history, nowhere else.

`content-repurposer` fixes both by making the voice a *skill* and the archive a *filesystem*.

## The voice is code-reviewed now

Everything about how your channels should sound sits in one skill in [`agent.js`](agent.js):

```js
const voiceRules = skill("voice-rules", {
  description: "House voice and per-channel formats for turning one blog post into a thread, a LinkedIn post, and a newsletter blurb.",
  instructions: "Voice - all channels:\n- First person, plain words, short sentences. No hashtags, no emoji, no hype adjectives like game-changing.\n- Lead with the most surprising concrete detail in the post, never with a definition.\n\nThread (thread.md):\n- 6 to 10 numbered tweets, each under 280 characters...",
  tools: [tools.files],
});
```

Per-channel formats — thread length and hook rules, LinkedIn's 120–200 words with a closing question, the newsletter's 40–70 word personal recommendation — all live here as one diffable block. When the brand voice shifts, you edit the skill and redeploy; every future derivative shifts together, and the git history is your style-guide changelog. Only the one-line description rides in base context; the full rules load when repurposing starts, and while the skill is active the agent's tools narrow to `files` alone.

The identity adds the guardrail that separates repurposing from hallucinating:

> "Derive, never invent: every claim in a derivative must exist in the source post. If the post is too thin for a channel, say so in that file instead of padding."

## An archive, not a clipboard

Each run writes three files under `repurposed/<post-slug>/` — `thread.md`, `linkedin.md`, `newsletter.md` — to the agent's durable filesystem, NVMe-fast locally and synced to S3 by the runtime. Six months of publishing later you have a browsable content library, and the `list` task reads it for zero tokens:

```js
agent.task("list", async () => {
  const names = await agent.files.list("repurposed");
  return Array.isArray(names) ? names.sort() : [];
});
```

The handler also validates before spending: a post under 100 characters is rejected at the boundary, and long posts are clipped to 12k characters — enough to carry any argument — before the single managed loop runs, capped at 12 steps and $0.60. The identity budget holds the whole agent to $3/day, which covers a publishing cadence most teams only dream about.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy content-repurposer
```

Feed it your latest post:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/content-repurposer/repurpose \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Why we killed our microservices", "post": "Three years ago we split the monolith..."}'
```

Back come three paths and three first lines — the thread hook, the LinkedIn opener, the blurb — with the full files waiting in the library. Wire it to your CMS publish webhook and derivatives simply exist by the time the post is live.

## What you didn't have to build

A style guide that lives in people's heads. A prompt document that drifts across five drafts in three tools. Storage for past derivatives. Consistency between channels — one skill, applied identically every run, is the consistency mechanism. Cost caps for the day an intern loops it over the whole back catalog.

You wrote the voice rules once, as a file. Now the six-hour post costs six hours — and the rest is one curl.
