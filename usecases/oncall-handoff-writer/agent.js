/**
 * oncall-handoff-writer — incidents stream into its log all week for free;
 * when the rotation turns, the handoff doc is already written.
 *
 * Scheduling pattern on display: REPORT-AT-BOUNDARY. The wake is aligned
 * to a period boundary (the weekly rotation turn), and its whole job is to
 * compress everything that accumulated inside the period into an artifact
 * for whoever owns the next one. Ingest is continuous and free; judgment
 * fires exactly once, at the edge.
 *
 * Deploy:  npm run deploy oncall-handoff-writer
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/oncall-handoff-writer/log-incident \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"severity": "sev2", "title": "API latency spike", "summary": "p99 hit 4s for 20 min; mitigated by rolling back the cache change", "resolved": true}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are oncall-handoff-writer: you make sure no on-call shift starts blind. Incidents land in your log all week; when the rotation turns, you compress the week into a handoff doc the next engineer can absorb in five minutes.\n\nState you own:\n- SQLite table incidents(id INTEGER PRIMARY KEY AUTOINCREMENT, severity TEXT, title TEXT, summary TEXT, resolved INTEGER, occurred_at TEXT). Create it if it does not exist before any read or write. severity is sev1, sev2, or sev3; resolved is 0 or 1.\n- Memory key last_handoff_at - ISO timestamp of the last handoff written.\n- Handoff files under handoffs/, one per rotation, named handoffs/YYYY-MM-DD.md.\n- Memory key handoff_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- A handoff doc has four sections in this order: Still open (every unresolved incident, oldest first - this is the section the next on-call actually needs), The week in incidents (one line each, grouped by severity), Patterns worth knowing (recurring symptoms or systems across the week, only if real - never invent a pattern from one data point), and By the numbers (counts by severity, resolved versus open).\n- Write plainly. The reader is tired and it is probably Monday morning.\n\nWake notes arrive as plain prompts. A note reading handoff means: if handoff_stopped is true, answer stopped and do nothing else. Otherwise read every incident with occurred_at after last_handoff_at plus every still-unresolved older incident, write handoffs/YYYY-MM-DD.md for today per the doc structure (a quiet week still gets a doc saying so - a silent handoff and a missing handoff look identical to the next on-call, so never skip), set last_handoff_at to now, then call schedule with in set to 7 days and note set to handoff. Answer with the open count and the totals by severity.\n\nTasks you receive:\n- start {}: run one handoff pass exactly as the handoff note describes. This is what kicks off the weekly chain.";

const agent = new Agent("oncall-handoff-writer", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 75 }, // one real writing pass per week
  },
  // db for the incident log, memory for the watermark and stop flag,
  // files for the handoff docs, schedule for the rotation-boundary wake.
  capabilities: [tools.db, tools.memory, tools.files, tools.schedule],
});

const INCIDENTS_TABLE = "CREATE TABLE IF NOT EXISTS incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, severity TEXT, title TEXT, summary TEXT, resolved INTEGER, occurred_at TEXT)";

// log-incident — pure primitives, zero LLM cost: wire your pager's
// resolve-hook here and the week logs itself.
agent.task("log-incident", async (args) => {
  const severity = ["sev1", "sev2", "sev3"].includes(args.severity) ? args.severity : "";
  const title = typeof args.title === "string" ? args.title.trim() : "";
  if (severity.length === 0 || title.length === 0) {
    throw new Error("log-incident requires { severity: sev1|sev2|sev3, title } (summary, resolved optional)");
  }
  const summary = typeof args.summary === "string" ? args.summary.trim() : "";
  const resolved = args.resolved === true ? 1 : 0;
  await agent.db.sql([INCIDENTS_TABLE]);
  await agent.db.sql`INSERT INTO incidents (severity, title, summary, resolved, occurred_at) VALUES (${severity}, ${title}, ${summary}, ${resolved}, ${new Date().toISOString()})`;
  return "Logged " + severity + ": " + title + (resolved ? " (resolved)" : " (OPEN)");
});

// resolve — zero-LLM: close an incident by id; it leaves the Still open
// section of the next handoff on its own.
agent.task("resolve", async (args) => {
  const id = Number(args.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("resolve requires { id }");
  await agent.db.sql([INCIDENTS_TABLE]);
  const result = await agent.db.sql`UPDATE incidents SET resolved = 1 WHERE id = ${id}`;
  return result.changes > 0 ? "Resolved incident " + id + "." : "No incident " + id + " found.";
});

// stop / start — the weekly chain's switches; stop is a zero-LLM flag.
agent.task("stop", async () => {
  await agent.memory.set("handoff_stopped", true);
  return "Stopped. The pending handoff wake will stand down when it fires.";
});

agent.task("start", async () => {
  await agent.memory.set("handoff_stopped", false);
  const result = await agent.llm("Task: start {}. Today is " + new Date().toISOString().slice(0, 10) + ".", {
    maxSteps: 16,
    maxCost: 0.5,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// latest — zero-LLM read of the newest handoff doc.
agent.task("latest", async () => {
  const names = await agent.files.list("handoffs");
  if (!Array.isArray(names) || names.length === 0) return "No handoffs yet - run start first.";
  const newest = [...names].sort().at(-1);
  const path = newest.startsWith("handoffs/") ? newest : "handoffs/" + newest;
  return await agent.files.read(path);
});

export default agent;
