/**
 * content-calendar-planner — a weekly planning run turns the idea backlog
 * into a Mon-Fri content plan; a light daily wake reads that plan back and
 * reminds you what today is for.
 *
 * Scheduling pattern on display: the PLANNER/EXECUTOR SPLIT. Two cadences
 * with a strict division of labor: the expensive weekly wake THINKS (reads
 * the backlog, writes the week's plan file), the cheap daily wake only
 * READS (opens the plan, relays today's slot). The plan file is the
 * contract between the two chains — planning happens once, execution
 * consults the artifact.
 *
 * Deploy:  npm run deploy content-calendar-planner
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/content-calendar-planner/add-idea \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"topic": "Why we moved our scheduler into the runtime"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are content-calendar-planner: once a week you turn the idea backlog into a realistic Mon-Fri content plan, and every morning you read that plan back and say what today is for. You plan weekly and remind daily; you never re-plan mid-week.\n\nState you own:\n- SQLite table ideas(id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, status TEXT, added_at TEXT). Create it if it does not exist before any read or write. status is backlog or planned.\n- Plan files under plans/, one per ISO week, named plans/YYYY-Www.md. Each plan lists Monday through Friday, one slot per day: the topic, the format (post, thread, or newsletter), and a two-line angle.\n- Memory key planner_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- send_reminder delivers the morning nudge to the writer.\n- Planning judgment: pick at most 5 backlog ideas for the week, prefer older ideas so nothing rots, vary the formats across the week, and mark chosen ideas as planned. Fewer than 5 ideas in the backlog means a lighter week - never pad with invented topics.\n\nWake notes arrive as plain prompts:\n- A note reading plan means: if planner_stopped is true, answer stopped and do nothing else. Otherwise write plans/YYYY-Www.md for the coming ISO week from the backlog per the planning judgment, then call schedule with in set to 7 days and note set to plan. Answer with the week and the topics chosen.\n- A note reading remind means: if planner_stopped is true, answer stopped and do nothing else. Otherwise open the current week's plan file, find today's slot, and send one send_reminder naming the topic, format, and angle; if today has no slot or no plan file exists, send nothing. Then call schedule with in set to 1 day and note set to remind. Answer in one line. Never write or edit a plan on a remind wake - reading the plan is the whole job.\n\nTasks you receive:\n- start {}: run one plan pass exactly as the plan note describes, then call schedule with in set to 1 day and note set to remind. This arms both the weekly planner and the daily reminder; answer with one line per chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to Slack, email, or your writing app. Custom tools
// live in source only — never in the manifest.
const sendReminder = {
  name: "send_reminder",
  description: "Send the writer one morning nudge: today's topic, format, and angle.",
  params: {
    type: "object",
    properties: {
      body: { type: "string", description: "The nudge, a few lines at most" },
    },
    required: ["body"],
  },
  // STUB — wire this to wherever the writer lives.
  async run({ body }) {
    return { delivered: true, chars: body.length };
  },
};

const agent = new Agent("content-calendar-planner", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 150 }, // one thinking run weekly + light daily reads
  },
  // db for the backlog, files for the weekly plan artifact, memory for
  // the stop flag, schedule for both chains.
  capabilities: [tools.db, tools.files, tools.memory, tools.schedule, sendReminder],
});

const IDEAS_TABLE = "CREATE TABLE IF NOT EXISTS ideas (id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, status TEXT, added_at TEXT)";

// add-idea — pure primitives, zero LLM cost: capture ideas the moment
// they happen, no tokens, no chain started.
agent.task("add-idea", async (args) => {
  const topic = typeof args.topic === "string" ? args.topic.trim() : "";
  if (topic.length === 0) throw new Error("add-idea requires { topic }");
  await agent.db.sql([IDEAS_TABLE]);
  await agent.db.sql`INSERT INTO ideas (topic, status, added_at) VALUES (${topic}, 'backlog', ${new Date().toISOString()})`;
  const count = await agent.db.sql`SELECT COUNT(*) AS n FROM ideas WHERE status = 'backlog'`;
  return "Captured. " + count.rows[0].n + " idea(s) in the backlog.";
});

// stop / start — one flag stands both chains down; start re-arms both.
agent.task("stop", async () => {
  await agent.memory.set("planner_stopped", true);
  return "Stopped. The pending plan and remind wakes will stand down when they fire.";
});

agent.task("start", async () => {
  await agent.memory.set("planner_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 20,
    maxCost: 0.6,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// current-plan — zero-LLM read of the newest weekly plan.
agent.task("current-plan", async () => {
  const names = await agent.files.list("plans");
  if (!Array.isArray(names) || names.length === 0) return "No plans yet - run start first.";
  const newest = [...names].sort().at(-1);
  const path = newest.startsWith("plans/") ? newest : "plans/" + newest;
  return await agent.files.read(path);
});

export default agent;
