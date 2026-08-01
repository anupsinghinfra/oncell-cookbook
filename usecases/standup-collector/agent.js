/**
 * standup-collector — pings every teammate for their update, compiles one
 * tidy standup, posts it, and books its own tomorrow. Nobody chases anyone.
 *
 * Superpowers on display:
 *   - schedule: the collect → compile → tomorrow chain is a set of durable
 *     wake intents in the runtime's park ledger — no cron box, no queue.
 *   - agents: cross-agent composition — the finished standup is filed with
 *     the daily-digest agent as a note, one tool call away.
 *
 * Deploy:  npm run deploy standup-collector
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/standup-collector/submit \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"name": "dana", "update": "Done: checkout flow. Doing: pricing page. Blocked: legal review."}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are standup-collector: the teammate who never forgets to ask for standup updates, never loses track of who has not replied, and posts one tidy summary instead of six scattered threads.\n\nState you own:\n- Memory key roster - a JSON array of { name, handle } for everyone you collect from.\n- Memory keys update:<YYYY-MM-DD>:<name> - the raw update each person submitted that day.\n\nHow you work:\n- send_message is your only way to reach people: pass a handle for a direct message, or team-standup for the shared channel.\n- Wake notes arrive as plain prompts. A note reading collect means run the collect task; a note reading compile means run the compile task.\n\nTasks you receive:\n- add-member { name, handle }: add the person to the roster (create it if missing, never duplicate a name) and confirm in one line with the new roster size.\n- submit { name, update }: store the update under update:<today>:<name> and confirm in one line naming everyone who has submitted today.\n- collect {}: read the roster and send each member a one-sentence friendly direct message asking for their standup update. Then call schedule twice: once with in set to 2 hours and note set to compile, once with in set to 1 day and note set to collect. Answer with how many pings went out.\n- compile {}: read every update:<today>:* key. Write one standup with sections Done, Doing, and Blocked - crisp bullets, each tagged with the teammate name - plus a final line naming anyone who did not reply. Post it to team-standup with send_message, then invoke the daily-digest agent task add-note with text set to a one-line summary of the standup; if that invoke fails, skip it without complaint. Answer with the compiled standup.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: replace `run` with a call to Slack, Teams, or your messenger.
// Custom tools live in source only — never in the manifest.
const sendMessage = {
  name: "send_message",
  description: "Send a message to a teammate (by handle) or to a channel like team-standup.",
  params: {
    type: "object",
    properties: {
      channel: { type: "string", description: "A teammate handle for a DM, or team-standup for the shared channel" },
      text: { type: "string", description: "The message to send" },
    },
    required: ["channel", "text"],
  },
  // STUB — wire this to your messenger's API.
  async run({ channel, text }) {
    return { sent: true, channel, chars: text.length };
  },
};

const agent = new Agent("standup-collector", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day covers the pings and one compile
  },
  // memory for the roster and the day's updates, schedule for the
  // collect → compile → tomorrow chain, agents to file the standup with
  // daily-digest. send_message is the stub messenger.
  capabilities: [tools.memory, tools.schedule, tools.agents, sendMessage],
});

/** One llm-loop pass per phase; the identity carries both procedures. */
async function runPhase(phase) {
  const result = await agent.llm(
    "Task: " + phase + " {}. Today is " + new Date().toISOString().slice(0, 10) + ".",
    { maxSteps: 16, maxCost: 0.5 },
  );
  return { status: result.status, cost: result.cost, summary: result.text };
}

agent.task("collect", () => runPhase("collect"));
agent.task("compile", () => runPhase("compile"));

// Belt-and-braces daily trigger; the schedule capability keeps the chain alive.
agent.schedule("daily-collect", "daily", () => runPhase("collect"), { maxCost: 0.5 });

agent.task("add-member", async (args) => {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const handle = typeof args.handle === "string" ? args.handle.trim() : "";
  if (name.length === 0 || handle.length === 0) {
    throw new Error("add-member requires { name, handle }");
  }
  const result = await agent.llm("Task: add-member " + JSON.stringify({ name, handle }), {
    maxSteps: 6,
    maxCost: 0.15,
  });
  return { reply: result.text, status: result.status, cost: result.cost };
});

agent.task("submit", async (args) => {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const update = typeof args.update === "string" ? args.update.trim() : "";
  if (name.length === 0 || update.length === 0) {
    throw new Error("submit requires { name, update }");
  }
  const result = await agent.llm("Task: submit " + JSON.stringify({ name, update }), {
    maxSteps: 6,
    maxCost: 0.15,
  });
  return { reply: result.text, status: result.status, cost: result.cost };
});

export default agent;
