/**
 * report-generator — metrics trickle in all week as zero-token SQLite
 * inserts; every Monday a polished markdown report writes itself and the
 * next Monday books itself.
 *
 * Superpowers on display:
 *   - db: the metrics log is a real SQLite table, written by a task that
 *     never touches the model — ingestion is free.
 *   - files: reports accumulate under reports/, a durable archive.
 *   - schedule: the weekly cadence is a self-booked wake intent.
 *
 * Deploy:  npm run deploy report-generator
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/report-generator/record \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"metric": "signups", "value": 42}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are report-generator: the analyst who turns a week of raw metric rows into the report people actually read - short, comparative, and honest about what moved.\n\nState you own:\n- SQLite table metrics(id INTEGER PRIMARY KEY AUTOINCREMENT, metric TEXT, value REAL, recorded_at TEXT). Rows are inserted by the record task without you; treat the table as read-only input.\n- Report files under reports/, one per run, named reports/YYYY-MM-DD.md for the day the report is written.\n\nHow you work:\n- A report covers the last 7 days and compares each metric against the 7 days before that. A metric with no prior-week data is marked new. Percent changes are computed from summed values per metric per week.\n- Wake notes arrive as plain prompts. A note reading report means run the report task.\n\nTasks you receive:\n- report {}: read the metrics table, write reports/YYYY-MM-DD.md with exactly three sections - Summary (3 bullets max on the biggest movers), Movers (every metric whose week-over-week change is 10 percent or more, one line each as metric: prior -> current (signed percent)), and Full table (every metric, current week total, prior week total, change). Then call schedule with in set to 7 days and note set to report. If the table is empty, write a report saying no data yet, still schedule next week. Answer with the report content.";

const agent = new Agent("report-generator", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 100 }, // one weekly report barely dents $1/day
  },
  // db for the metrics log, files for the report archive, schedule so
  // every Monday books the next one.
  capabilities: [tools.db, tools.files, tools.schedule],
});

const METRICS_TABLE = "CREATE TABLE IF NOT EXISTS metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, metric TEXT, value REAL, recorded_at TEXT)";

// record — pure primitives, zero LLM cost. Fire this from cron jobs, CI,
// app code, anywhere: ingestion never spends a token.
agent.task("record", async (args) => {
  const metric = typeof args.metric === "string" ? args.metric.trim() : "";
  const value = Number(args.value);
  if (metric.length === 0 || !Number.isFinite(value)) {
    throw new Error("record requires { metric, value }");
  }
  await agent.db.sql([METRICS_TABLE]);
  const now = new Date().toISOString();
  await agent.db.sql`INSERT INTO metrics (metric, value, recorded_at) VALUES (${metric}, ${value}, ${now})`;
  return { recorded: true, metric, value };
});

/** One report pass; the identity carries the format and the comparisons. */
async function runReport() {
  const result = await agent.llm(
    "Task: report {}. Today is " + new Date().toISOString().slice(0, 10) + ".",
    { maxSteps: 16, maxCost: 0.5 },
  );
  return { status: result.status, cost: result.cost, report: result.text };
}

agent.task("report", () => runReport());

// Belt-and-braces weekly trigger; the schedule capability keeps the chain alive.
agent.schedule("weekly-report", "weekly", runReport, { maxCost: 0.5 });

// latest — pure primitives, zero LLM cost: read the newest report verbatim.
agent.task("latest", async () => {
  const names = await agent.files.list("reports");
  if (!Array.isArray(names) || names.length === 0) {
    return "No reports yet - invoke the report task first.";
  }
  const newest = [...names].sort().at(-1);
  const path = newest.startsWith("reports/") ? newest : "reports/" + newest;
  return await agent.files.read(path);
});

export default agent;
