/**
 * backup-auditor — verifies every backup job daily for pennies, and once a
 * month refuses to trust the green checkmarks: it parks on a human and
 * makes someone actually restore something.
 *
 * Scheduling pattern on display: CADENCE WITH A HUMAN GATE. Two chains at
 * different speeds — a fast, fully-automated daily verify, and a slow
 * monthly restore drill that ends in ask_human. The drill wake parks at $0
 * until a person confirms the restore; the daily chain keeps running
 * underneath, completely unblocked by the park.
 *
 * Deploy:  npm run deploy backup-auditor
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/backup-auditor/add-job \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"job": "prod-postgres-nightly"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are backup-auditor: you believe a backup that has never been restored is a rumor. Daily you verify that every job produced a fresh backup; monthly you make a human actually restore one.\n\nState you own:\n- SQLite table jobs(id INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT UNIQUE, last_ok TEXT, last_size_mb REAL, last_drill TEXT, drill_result TEXT). Create it if it does not exist before any read or write.\n- Memory key auditor_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- check_backup takes a job name and reports ok, size_mb, and completed_at for its most recent run.\n- A job fails verification when ok is false, or completed_at is older than 26 hours, or size_mb dropped more than 50 percent below last_size_mb. Failures are worth naming loudly in your answer; do not stay quiet.\n\nWake notes arrive as plain prompts:\n- A note reading verify means: if auditor_stopped is true, answer stopped and do nothing else. Otherwise run check_backup for every job, apply the failure rule, update last_ok and last_size_mb for passing jobs, then call schedule with in set to 1 day and note set to verify. Answer one line per job: <job>: ok (<size> MB) or FAILED <reason>.\n- A note reading drill means: if auditor_stopped is true, answer stopped and do nothing else. Otherwise pick the job with the oldest last_drill (never drilled counts as oldest), then call ask_human with a question naming that job and asking the operator to restore its latest backup to a scratch environment and reply with what they found. When the answer arrives, set last_drill to now and drill_result to a one-line summary of the answer, then call schedule with in set to 30 days and note set to drill. Answer with the job drilled and the result.\n\nTasks you receive:\n- start {}: run one verify pass exactly as the verify note describes, then call schedule with in set to 30 days and note set to drill. This arms both the daily chain and the monthly drill; answer with one line per chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to your backup system (pgBackRest, restic, AWS
// Backup, ...). Custom tools live in source only — never in the manifest.
const checkBackup = {
  name: "check_backup",
  description: "Check the most recent run of a backup job: ok, size_mb, completed_at.",
  params: {
    type: "object",
    properties: { job: { type: "string", description: "The backup job name" } },
    required: ["job"],
  },
  // STUB — wire this to your backup system's API.
  async run({ job }) {
    return { job, ok: true, size_mb: 812.4, completed_at: new Date().toISOString() };
  },
};

const agent = new Agent("backup-auditor", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // a daily mechanical check must cost pennies
    budgets: { perDayCents: 50 },
  },
  // db for the jobs ledger, memory for the stop flag, schedule for both
  // chains, ask_human as the monthly gate a green dashboard cannot fake.
  capabilities: [tools.db, tools.memory, tools.schedule, tools.ask_human, checkBackup],
});

const JOBS_TABLE = "CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT UNIQUE, last_ok TEXT, last_size_mb REAL, last_drill TEXT, drill_result TEXT)";

// add-job — pure primitives, zero LLM cost: registering jobs never spends
// a token and never starts a chain.
agent.task("add-job", async (args) => {
  const job = typeof args.job === "string" ? args.job.trim() : "";
  if (job.length === 0) throw new Error("add-job requires { job }");
  await agent.db.sql([JOBS_TABLE]);
  await agent.db.sql`INSERT OR IGNORE INTO jobs (job) VALUES (${job})`;
  const count = await agent.db.sql`SELECT COUNT(*) AS n FROM jobs`;
  return "Auditing " + job + ". " + count.rows[0].n + " job(s) on the books. Run start to arm the chains.";
});

// stop / start — one flag stands both chains down. A drill parked on a
// human still completes its ask, but the chain re-books nothing once
// stopped: the NEXT wake reads the flag and stands down.
agent.task("stop", async () => {
  await agent.memory.set("auditor_stopped", true);
  return "Stopped. The pending verify and drill wakes will stand down when they fire.";
});

agent.task("start", async () => {
  await agent.memory.set("auditor_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 24,
    maxCost: 0.2,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// status — zero-LLM read: verification freshness and the drill ledger.
agent.task("status", async () => {
  await agent.db.sql([JOBS_TABLE]);
  const result = await agent.db.sql`SELECT job, last_ok, last_size_mb, last_drill, drill_result FROM jobs ORDER BY job`;
  return result.rows;
});

export default agent;
