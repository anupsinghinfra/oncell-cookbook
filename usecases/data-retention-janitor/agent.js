/**
 * data-retention-janitor — an agent whose weekly job is cleaning up after
 * itself: it applies declared retention rules to its own database and
 * files, then reports exactly what it purged.
 *
 * Scheduling pattern on display: the SELF-MAINTENANCE CADENCE. The agent
 * is its own operand. Long-lived agents accumulate state the way any
 * system does — event rows, report files, stale keys — and a runtime that
 * makes state durable-by-default needs agents that garbage-collect
 * deliberately. Here the schedule points the agent at itself, on a weekly
 * clock, with the rules in state so changing policy never means
 * redeploying.
 *
 * Deploy:  npm run deploy data-retention-janitor
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/data-retention-janitor/log-event \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"kind": "page_view", "payload": "/pricing"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are data-retention-janitor: you keep your own house in order. Once a week you apply the declared retention rules to your own database and files, and you publish an honest accounting of everything you threw away.\n\nState you own:\n- SQLite table events(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, payload TEXT, created_at TEXT). Create it if it does not exist before any read or write. This is the working data other systems feed you.\n- Memory key retention_rules - JSON { events_days, reports_keep }. events_days is how many days of events rows to keep; reports_keep is how many recent sweep reports to keep. Missing rules mean nothing is purged - you never guess a retention policy.\n- Sweep reports under reports/, one per sweep, named reports/YYYY-MM-DD.md.\n- Memory key janitor_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- Purge with SQL and file deletes directly; deletion is mechanical work, not judgment. Count before and after so the report states exact numbers.\n- The report lists: events rows deleted and the cutoff date used, report files deleted by name, rows and files remaining, and the rules as currently set. If the rules are missing, the report says so and nothing is deleted.\n- You only ever touch your own tables and your own files. Nothing outside your cell is yours to clean.\n\nWake notes arrive as plain prompts. A note reading sweep means: if janitor_stopped is true, answer stopped and do nothing else. Otherwise read retention_rules, delete events rows older than events_days, delete the oldest sweep reports beyond reports_keep, write reports/YYYY-MM-DD.md per the report structure, then call schedule with in set to 7 days and note set to sweep. Answer in one line: <n> rows purged, <m> files purged, next sweep in 7 days.\n\nTasks you receive:\n- start {}: run one sweep pass exactly as the sweep note describes. This is what kicks off the weekly chain.";

const agent = new Agent("data-retention-janitor", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // deletion is mechanical; the report is short
    budgets: { perDayCents: 40 },
  },
  // db and files are both the workload and the cleaning target; memory
  // holds the rules and stop flag; schedule points the agent at itself.
  capabilities: [tools.db, tools.files, tools.memory, tools.schedule],
});

const EVENTS_TABLE = "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, payload TEXT, created_at TEXT)";

// log-event — pure primitives, zero LLM cost: the working data other
// systems pour in. This is what the janitor will eventually sweep.
agent.task("log-event", async (args) => {
  const kind = typeof args.kind === "string" ? args.kind.trim() : "";
  if (kind.length === 0) throw new Error("log-event requires { kind } (payload optional)");
  const payload = typeof args.payload === "string" ? args.payload : "";
  await agent.db.sql([EVENTS_TABLE]);
  await agent.db.sql`INSERT INTO events (kind, payload, created_at) VALUES (${kind}, ${payload}, ${new Date().toISOString()})`;
  return "Logged " + kind + ".";
});

// set-rules — pure primitives, zero LLM cost: retention policy lives in
// state, so changing it never means redeploying the agent.
agent.task("set-rules", async (args) => {
  const eventsDays = Number(args.events_days);
  const reportsKeep = Number(args.reports_keep);
  if (!Number.isInteger(eventsDays) || eventsDays < 1 || !Number.isInteger(reportsKeep) || reportsKeep < 1) {
    throw new Error("set-rules requires { events_days >= 1, reports_keep >= 1 }");
  }
  await agent.memory.set("retention_rules", { events_days: eventsDays, reports_keep: reportsKeep });
  return "Rules set: keep " + eventsDays + " days of events, " + reportsKeep + " sweep reports. Run start to arm the weekly sweep.";
});

// stop / start — the weekly chain's switches; stop is a zero-LLM flag.
agent.task("stop", async () => {
  await agent.memory.set("janitor_stopped", true);
  return "Stopped. The pending sweep will stand down when it wakes.";
});

agent.task("start", async () => {
  await agent.memory.set("janitor_stopped", false);
  const result = await agent.llm("Task: start {}. Today is " + new Date().toISOString().slice(0, 10) + ".", {
    maxSteps: 20,
    maxCost: 0.15,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// last-sweep — zero-LLM read of the most recent accounting.
agent.task("last-sweep", async () => {
  const names = await agent.files.list("reports");
  if (!Array.isArray(names) || names.length === 0) return "No sweeps yet - set rules and run start.";
  const newest = [...names].sort().at(-1);
  const path = newest.startsWith("reports/") ? newest : "reports/" + newest;
  return await agent.files.read(path);
});

export default agent;
