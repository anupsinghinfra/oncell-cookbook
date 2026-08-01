/**
 * TEMPLATE — copy this directory to usecases/<your-slug>/ and fill it in.
 *
 *   cp -r TEMPLATE usecases/my-agent
 *
 * A use case is 5 files:
 *   agent.js       the deployable source (this file)
 *   manifest.json  the deploy-time contract — must match this file exactly
 *   usecase.json   catalog entry + smoke task
 *   blog.md        the deep-dive post
 *   video.md       the 60-90s video script
 *
 * Then: npm run validate  →  npm run deploy my-agent  →  npm run smoke my-agent
 *
 * ── The agent model in one breath ─────────────────────────────────────────
 * You describe an agent with three primitives; the runtime does the rest:
 *   IDENTITY      who it is: instructions, model, spend budgets
 *   CAPABILITIES  what it can touch: prebuilt tools + custom functions
 *   SKILLS        what it knows how to do: a prompt for specific work
 *                 plus the tools scoped to that work
 * Durability, parking, scheduling, replay, metering, observability — all
 * runtime, all invisible, all free of code on your side.
 */
import { Agent, tools, skill } from "oncell";

// ── Identity instructions ──────────────────────────────────────────────────
// CONVENTION: write instruction strings as SINGLE JSON-style literals
// (double quotes, \n escapes, no template literals). `npm run validate`
// verifies manifest.json matches agent.js byte-for-byte, which only works
// when both files carry the identical string.
//
// The instructions must stand on their own: on the deployed platform they
// are the system prompt of a managed think→act loop, and task arguments
// arrive as a JSON prompt. Describe (1) who the agent is, (2) how it works
// — which state it owns, which tools to reach for — and (3) every task it
// receives with the input shape and the expected answer format.
const IDENTITY_INSTRUCTIONS = "You are my-agent, a one-sentence description of who this agent is.\n\nHow you work:\n- Which durable state you own (memory keys, SQLite tables, file paths) and when to touch it.\n\nTasks you receive:\n- run { input }: what to do and exactly what to answer.";

// ── Custom capability (optional) ───────────────────────────────────────────
// Custom tools are the same shape as prebuilt ones to the model. `params`
// is the JSON schema the model sees; `run` executes in your agent's
// sandbox. Custom tools live in source only — never in the manifest.
const myTool = {
  name: "my_tool",
  description: "One line the model reads when deciding whether to call this.",
  params: {
    type: "object",
    properties: { query: { type: "string", description: "What to look up" } },
    required: ["query"],
  },
  // STUB — replace with a call to your real system.
  async run({ query }) {
    return { query, answer: "stubbed" };
  },
};

// ── Skill (optional) ───────────────────────────────────────────────────────
// A skill = a prompt for specific work + the tools it uses. Only the
// description (max 200 chars) rides in base context; the instructions load
// on demand, and while the skill is active the agent's tools narrow to
// exactly this list. Reference prebuilt handles (tools.*) or custom tools
// declared in capabilities.
const mySkill = skill("my-skill", {
  description: "When to use this skill, in one line - this text is always in context.",
  instructions: "The full procedure, loaded only when the work calls for it:\n1. Step one.\n2. Step two.",
  tools: [myTool, tools.memory],
});

const agent = new Agent("my-agent", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet", // or claude-haiku for cheap high-volume work
    budgets: { perDayCents: 100 }, // hard daily spend ceiling, runtime-enforced
  },
  // Prebuilt handles: tools.memory, tools.db, tools.files, tools.shell,
  // tools.secrets, tools.ask_human, tools.agents, tools.cells, tools.schedule
  capabilities: [tools.memory, myTool],
  skills: [mySkill],
});

// ── Triggers ───────────────────────────────────────────────────────────────
// task(name, handler)      → POST /api/v1/agents/my-agent/<name>
// chat(handler)            → POST /api/v1/agents/my-agent/chat
// schedule(name, cron, fn) → recurring runs ("daily", "hourly", "every 30 m")
// onWebhook(path, handler) → external events
agent.task("run", async (args) => {
  // Validate at the boundary — fail fast before spending a token.
  const input = typeof args.input === "string" ? args.input : "";
  if (input.length === 0) throw new Error("run requires { input }");

  // One managed loop: think → act (tools) → look → repeat. Literal
  // maxSteps/maxCost numbers double as deploy-time limits.
  const result = await agent.llm("Task: run " + JSON.stringify({ input }), {
    maxSteps: 8,
    maxCost: 0.25,
  });

  // Direct primitives work too, outside the loop and LLM-free:
  //   await agent.memory.set("key", value)
  //   await agent.db.sql`SELECT * FROM t WHERE id = ${id}`
  //   await agent.files.write("path.md", "content")
  //   await agent.shell("wc -l file")
  //   await agent.askHuman({ question: "Ship it?" })
  return { reply: result.text, status: result.status, cost: result.cost };
});

export default agent;
