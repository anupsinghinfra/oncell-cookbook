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
| [`code-reviewer`](usecases/code-reviewer/agent.js) | Paste a diff, get a senior-engineer review — produced in a sandbox where the agent runs grep on the patch instead of guessing. | `shell` `files` `llm-loop` | [blog](usecases/code-reviewer/blog.md) | [video](usecases/code-reviewer/video.md) |
| [`daily-digest`](usecases/daily-digest/agent.js) | Compiles a crisp morning briefing from the team's notes, then schedules its own tomorrow — no cron box anywhere. | `schedule` `db` `files` `memory` | [blog](usecases/daily-digest/blog.md) | [video](usecases/daily-digest/video.md) |
| [`expense-approver`](usecases/expense-approver/agent.js) | Auto-approves small expenses, parks at $0 waiting for a human on big ones — and survives crashes while it waits. | `ask_human` `budgets` `db` `skills` | [blog](usecases/expense-approver/blog.md) | [video](usecases/expense-approver/video.md) |
| [`inbox-triager`](usecases/inbox-triager/agent.js) | Labels, prioritizes, and suggests an action for every email — with skills as packaged procedures and a memory of every sender. | `skills` `memory` `memory.transact` `llm-loop` | [blog](usecases/inbox-triager/blog.md) | [video](usecases/inbox-triager/video.md) |
| [`support-agent`](usecases/support-agent/agent.js) | Customer support that remembers every customer — and can't refund a cent without human approval. | `memory.forUser` `skills` `ask_human` `custom-tools` | [blog](usecases/support-agent/blog.md) | [video](usecases/support-agent/video.md) |
<!-- catalog:end -->

Sixteen more use cases are specced and reserved in [CATALOG.md](CATALOG.md).

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
