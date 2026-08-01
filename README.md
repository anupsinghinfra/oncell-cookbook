# oncell-cookbook

**Production-ready AI agents you can deploy in one command.**

Every recipe in this repo is a complete, working agent for [OnCell](https://oncell.ai) — the runtime that keeps agents alive forever: durable state, crash-proof waits on humans, self-scheduling, hard spend budgets, full traces. You clone, add an API key, and deploy. Each use case ships four things: the agent source, its deploy manifest, a deep-dive blog post, and a video script.

## The agent model, in ten lines

You describe an agent with three primitives. Everything else is runtime, and invisible:

```
IDENTITY       who it is — instructions, model, spend budgets ("max $5/day", runtime-enforced)
CAPABILITIES   what it can touch — memory, db, files, shell, secrets, ask_human,
               agents, cells, schedule, plus your own custom tools
SKILLS         what it knows how to do — a prompt for specific work + the tools
               scoped to that work; instructions load on demand, tools narrow while active
────────────────────────────────────────────────────────────────────────────────
RUNTIME        durability, parking at $0 while waiting, scheduled wakes, replay
               (finished LLM calls are never re-paid), gVisor sandboxes, metering, traces
```

## A complete agent

This is real, deployable source — not pseudocode ([`usecases/expense-approver/agent.js`](usecases/expense-approver/agent.js), trimmed):

```js
import { Agent, tools, skill } from "oncell";

const escalation = skill("escalation", {
  description: "Escalate an expense to a human approver and wait for the decision - required at $50 and above or when anything is unclear.",
  instructions: "Escalation procedure:\n1. Summarize the expense in one line.\n2. Call ask_human - the run parks at zero cost until a human answers. ...",
  tools: [tools.ask_human, tools.db],
});

const agent = new Agent("expense-approver", {
  identity: {
    instructions: "You are expense-approver: the policy, the paper trail, and the pause button ...",
    model: "claude-sonnet",
    budgets: { perDayCents: 200 },       // hard $2/day ceiling, enforced by the runtime
  },
  capabilities: [tools.db, tools.ask_human],
  skills: [escalation],
});

agent.task("approve-expense", async (args) => {
  const result = await agent.llm("Task: approve-expense " + JSON.stringify(args), {
    maxSteps: 10, maxCost: 0.3,
  });
  return { decision: result.text, status: result.status, cost: result.cost };
});

export default agent;
```

Small expenses come back `APPROVED` in seconds. A $240 conference ticket hits `ask_human` and the run **parks** — $0/hour, surviving crashes and redeploys — until a human clicks approve, days later, and it resumes mid-procedure.

## Catalog

<!-- catalog:start -->
| Agent | What it does | Primitives it shows | Blog | Video |
|---|---|---|---|---|
| [`churn-detector`](usecases/churn-detector/agent.js) | Product events stream into SQLite for free; a weekly rubric pass scores every account and flags the ones drifting toward the exit. | `db` `schedule` `skills` | [blog](usecases/churn-detector/blog.md) | [video](usecases/churn-detector/video.md) |
| [`code-reviewer`](usecases/code-reviewer/agent.js) | Paste a diff, get a senior-engineer review — produced in a sandbox where the agent runs grep on the patch instead of guessing. | `shell` `files` `llm-loop` | [blog](usecases/code-reviewer/blog.md) | [video](usecases/code-reviewer/video.md) |
| [`competitor-watcher`](usecases/competitor-watcher/agent.js) | Reads competitor changelogs and pricing pages daily, diffs them against memory, and digests only what actually changed. | `memory` `schedule` `custom-tools` | [blog](usecases/competitor-watcher/blog.md) | [video](usecases/competitor-watcher/video.md) |
| [`content-repurposer`](usecases/content-repurposer/agent.js) | Turns one blog post into a thread, a LinkedIn post, and a newsletter blurb — voice rules packaged as a versioned skill. | `skills` `files` | [blog](usecases/content-repurposer/blog.md) | [video](usecases/content-repurposer/video.md) |
| [`daily-digest`](usecases/daily-digest/agent.js) | Compiles a crisp morning briefing from the team's notes, then schedules its own tomorrow — no cron box anywhere. | `schedule` `db` `files` `memory` | [blog](usecases/daily-digest/blog.md) | [video](usecases/daily-digest/video.md) |
| [`data-cleaner`](usecases/data-cleaner/agent.js) | Drop a messy CSV on it, get back a normalized file plus a counted change report — cleaning rules as a skill, verification by real shell. | `files` `shell` `skills` | [blog](usecases/data-cleaner/blog.md) | [video](usecases/data-cleaner/video.md) |
| [`expense-approver`](usecases/expense-approver/agent.js) | Auto-approves small expenses, parks at $0 waiting for a human on big ones — and survives crashes while it waits. | `ask_human` `budgets` `db` `skills` | [blog](usecases/expense-approver/blog.md) | [video](usecases/expense-approver/video.md) |
| [`faq-builder`](usecases/faq-builder/agent.js) | Ingests support transcripts one by one, clusters recurring questions in SQLite, and emits a FAQ ranked by how often customers actually ask. | `db` `files` `llm-loop` | [blog](usecases/faq-builder/blog.md) | [video](usecases/faq-builder/video.md) |
| [`inbox-triager`](usecases/inbox-triager/agent.js) | Labels, prioritizes, and suggests an action for every email — with skills as packaged procedures and a memory of every sender. | `skills` `memory` `memory.transact` `llm-loop` | [blog](usecases/inbox-triager/blog.md) | [video](usecases/inbox-triager/video.md) |
| [`invoice-chaser`](usecases/invoice-chaser/agent.js) | Politely escalating payment reminders that sleep 7 days at $0 between nudges — and stand down the moment payment lands. | `schedule` `db` `ask_human` `custom-tools` | [blog](usecases/invoice-chaser/blog.md) | [video](usecases/invoice-chaser/video.md) |
| [`lead-qualifier`](usecases/lead-qualifier/agent.js) | Scores inbound leads against your ICP rubric — instant verdicts on the obvious, a $0 park for a human on the borderline. | `skills` `ask_human` `db` | [blog](usecases/lead-qualifier/blog.md) | [video](usecases/lead-qualifier/video.md) |
| [`meeting-scheduler`](usecases/meeting-scheduler/agent.js) | Negotiates a meeting time over email, parking at $0 between counter-proposals — one run can span a week of back-and-forth. | `ask_human` `memory` `custom-tools` | [blog](usecases/meeting-scheduler/blog.md) | [video](usecases/meeting-scheduler/video.md) |
| [`onboarding-emailer`](usecases/onboarding-emailer/agent.js) | Runs a per-user onboarding email sequence — each touch schedules the next, and users who activate simply stop hearing from it. | `schedule` `memory.forUser` `custom-tools` | [blog](usecases/onboarding-emailer/blog.md) | [video](usecases/onboarding-emailer/video.md) |
| [`price-monitor`](usecases/price-monitor/agent.js) | Watches competitor prices daily, keeps the full history in SQLite, and only speaks up when a move crosses your threshold. | `schedule` `db` `custom-tools` | [blog](usecases/price-monitor/blog.md) | [video](usecases/price-monitor/video.md) |
| [`release-notes-writer`](usecases/release-notes-writer/agent.js) | Paste a commit log, get customer-facing release notes — grounded by real shell commands, styled by a versioned skill. | `skills` `files` `shell` | [blog](usecases/release-notes-writer/blog.md) | [video](usecases/release-notes-writer/video.md) |
| [`report-generator`](usecases/report-generator/agent.js) | Metrics trickle in all week as zero-token SQLite inserts; every Monday a polished markdown report compiles itself and books next week. | `db` `files` `schedule` | [blog](usecases/report-generator/blog.md) | [video](usecases/report-generator/video.md) |
| [`review-responder`](usecases/review-responder/agent.js) | Drafts on-brand replies to app-store and G2 reviews — positives post instantly, negatives park for human sign-off first. | `skills` `ask_human` `memory` | [blog](usecases/review-responder/blog.md) | [video](usecases/review-responder/video.md) |
| [`seo-brief-writer`](usecases/seo-brief-writer/agent.js) | Turns a keyword into a complete content brief — outline, entities, FAQs — grounded in SERP data and archived to a brief library. | `files` `skills` `custom-tools` | [blog](usecases/seo-brief-writer/blog.md) | [video](usecases/seo-brief-writer/video.md) |
| [`standup-collector`](usecases/standup-collector/agent.js) | Pings every teammate for their update, compiles one tidy standup, posts it — and books its own tomorrow. | `schedule` `memory` `agents` `custom-tools` | [blog](usecases/standup-collector/blog.md) | [video](usecases/standup-collector/video.md) |
| [`support-agent`](usecases/support-agent/agent.js) | Customer support that remembers every customer — and can't refund a cent without human approval. | `memory.forUser` `skills` `ask_human` `custom-tools` | [blog](usecases/support-agent/blog.md) | [video](usecases/support-agent/video.md) |
| [`uptime-watchdog`](usecases/uptime-watchdog/agent.js) | Probes your endpoints every 5 minutes, remembers incident state, and alerts only on transitions — never twice for the same outage. | `schedule` `memory` `custom-tools` | [blog](usecases/uptime-watchdog/blog.md) | [video](usecases/uptime-watchdog/video.md) |
<!-- catalog:end -->

The catalog contract behind these slugs lives in [CATALOG.md](CATALOG.md).

## Quickstart

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env            # add your ONCELL_API_KEY (oncell_sk_...)

npm run deploy support-agent    # deploy one use case (or: npm run deploy -- --all)
npm run list                    # see your deployed agents
```

Invoke it:

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/support-agent/chat \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Where is my order AC-1042?"}'
```

Or run the built-in cheap smoke test for any use case:

```bash
npm run smoke support-agent     # or: npm run smoke -- --all
```

No dependencies to install — the scripts are plain Node 20.

## Contributing — add a use case in 4 files

1. `cp -r TEMPLATE usecases/<your-slug>` and edit:
   - **`agent.js`** — the deployable source. Default-exports `new Agent("<your-slug>", ...)`.
   - **`manifest.json`** — the deploy-time identity/capabilities/skills contract. Must match `agent.js` byte-for-byte (instruction strings are single JSON-style literals for exactly this reason).
   - **`usecase.json`** — catalog entry plus a cheap `smokeTask` (≤ one small LLM turn, or `null` if every path parks on a human).
   - **`blog.md`** + **`video.md`** — the deep dive and the 60–90s script.
2. `npm run validate` — schema-checks every manifest against OnCell's real deploy schema and verifies `agent.js` ↔ `manifest.json` sync. Must pass clean.
3. `npm run catalog` — regenerates the table above from `usecase.json` files.

Picking up a reserved slug from [CATALOG.md](CATALOG.md) is the fastest way to contribute.

## License

[MIT](LICENSE)
