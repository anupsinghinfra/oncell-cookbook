/**
 * crm-touch-cadence — every morning it scores your whole network for
 * relationship decay and hands you the three people to reach out to today,
 * with an opener drafted for each.
 *
 * Scheduling pattern on display: DECAY SCORING AT WAKE. The schedule holds
 * no per-contact bookkeeping — no "remind me about Dana in 3 weeks" jobs
 * piling up. One daily wake recomputes decay for everyone from first
 * principles (days since last touch, weighted by importance) and picks the
 * top of the leaderboard. State decays; the wake just reads the clock.
 *
 * Deploy:  npm run deploy crm-touch-cadence
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/crm-touch-cadence/add-contact \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"name": "Dana Reyes", "email": "dana@northwind.example", "relationship": "former manager, now CFO at Northwind", "importance": 3}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are crm-touch-cadence: you keep relationships from going quietly cold. Every morning you find the three people most overdue for a touch and draft an opener for each, so reaching out takes minutes instead of willpower.\n\nState you own:\n- SQLite table contacts(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, email TEXT, relationship TEXT, importance INTEGER, last_touch TEXT, last_suggested TEXT). Create it if it does not exist before any read or write. importance is 1 to 3.\n- Memory key cadence_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- Decay score = days since last_touch multiplied by importance. An empty last_touch counts as 90 days. Skip anyone suggested in the last 7 days (last_suggested) - nagging about the same person daily kills the habit.\n- An opener is 2 or 3 sentences in the voice of a busy friend, grounded in the relationship field. Never invent shared history that is not in the row; when the row is thin, keep the opener honest and simple.\n- send_digest delivers the morning list to the user.\n\nWake notes arrive as plain prompts. A note reading cadence means: if cadence_stopped is true, answer stopped and do nothing else. Otherwise compute the decay score for every contact, take the top 3 eligible ones with a score of at least 30, draft an opener for each, deliver them in one send_digest call, and set last_suggested to now on those rows. If nobody clears the bar, send nothing. Then call schedule with in set to 1 day and note set to cadence. Answer with the names suggested, or quiet day.\n\nTasks you receive:\n- start {}: run one cadence pass exactly as the cadence note describes. This is what kicks off the daily chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to email, Slack DM, or a note app. Custom tools
// live in source only — never in the manifest.
const sendDigest = {
  name: "send_digest",
  description: "Deliver the morning outreach list: up to 3 people with a drafted opener each.",
  params: {
    type: "object",
    properties: {
      body: { type: "string", description: "The digest: per person, why now and the drafted opener" },
    },
    required: ["body"],
  },
  // STUB — wire this to wherever you want the list each morning.
  async run({ body }) {
    return { delivered: true, chars: body.length };
  },
};

const agent = new Agent("crm-touch-cadence", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 100 }, // one pass of real drafting per day
  },
  // db for the contacts ledger, memory for the stop flag, schedule for
  // the daily decay-scoring wake.
  capabilities: [tools.db, tools.memory, tools.schedule, sendDigest],
});

const CONTACTS_TABLE = "CREATE TABLE IF NOT EXISTS contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, email TEXT, relationship TEXT, importance INTEGER, last_touch TEXT, last_suggested TEXT)";

// add-contact — pure primitives, zero LLM cost: build the network table
// without spending a token or starting the chain.
agent.task("add-contact", async (args) => {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  if (name.length === 0) throw new Error("add-contact requires { name } (email, relationship, importance optional)");
  const email = typeof args.email === "string" ? args.email.trim() : "";
  const relationship = typeof args.relationship === "string" ? args.relationship.trim() : "";
  const importance = [1, 2, 3].includes(Number(args.importance)) ? Number(args.importance) : 1;
  await agent.db.sql([CONTACTS_TABLE]);
  await agent.db.sql`INSERT INTO contacts (name, email, relationship, importance, last_touch, last_suggested) VALUES (${name}, ${email}, ${relationship}, ${importance}, '', '') ON CONFLICT(name) DO UPDATE SET email = ${email}, relationship = ${relationship}, importance = ${importance}`;
  return "Added " + name + " (importance " + importance + "). Run start to arm the morning cadence.";
});

// touched — zero-LLM: log that you actually reached out; the decay clock
// for that person resets to zero.
agent.task("touched", async (args) => {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  if (name.length === 0) throw new Error("touched requires { name }");
  await agent.db.sql([CONTACTS_TABLE]);
  const result = await agent.db.sql`UPDATE contacts SET last_touch = ${new Date().toISOString()} WHERE name = ${name}`;
  return result.changes > 0 ? "Reset the clock on " + name + "." : "No contact named " + name + ".";
});

// stop / start — the chain's switches; stop is a zero-LLM flag flip.
agent.task("stop", async () => {
  await agent.memory.set("cadence_stopped", true);
  return "Stopped. The pending morning wake will stand down when it fires.";
});

agent.task("start", async () => {
  await agent.memory.set("cadence_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 16,
    maxCost: 0.4,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// coldest — zero-LLM read: the decay leaderboard, computed in SQL.
agent.task("coldest", async () => {
  await agent.db.sql([CONTACTS_TABLE]);
  const result = await agent.db.sql`SELECT name, importance, last_touch, last_suggested FROM contacts ORDER BY CASE WHEN last_touch = '' THEN 90 ELSE julianday('now') - julianday(last_touch) END * importance DESC LIMIT 10`;
  return result.rows;
});

export default agent;
