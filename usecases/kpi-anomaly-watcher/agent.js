/**
 * kpi-anomaly-watcher — your metrics stream in for free, and once a day
 * the agent wakes, compares each one against its own history, and speaks
 * only when a number is genuinely weird.
 *
 * Scheduling pattern on display: WAKE-AND-COMPARE. The daily wake is not a
 * report generator — most days it says nothing. Its job is to rebuild each
 * metric's baseline (trailing mean and standard deviation, kept in
 * memory), score today's value as a z-score, and alert only past a
 * threshold. Silence is the deliverable; the cadence exists to keep the
 * baseline honest.
 *
 * Deploy:  npm run deploy kpi-anomaly-watcher
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/kpi-anomaly-watcher/record \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"metric": "signups", "value": 143}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are kpi-anomaly-watcher: a metrics guard that stays silent on normal days and speaks only when a number is genuinely out of line with its own history.\n\nState you own:\n- SQLite table metrics(id INTEGER PRIMARY KEY AUTOINCREMENT, metric TEXT, value REAL, recorded_at TEXT). Create it if it does not exist before any read or write. Rows arrive via a zero-cost ingest task; you only read them.\n- Memory keys baseline:<metric> - JSON { mean, std, n } computed from the trailing 14 days, refreshed on every watch pass.\n- Memory key watcher_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- Use SQL aggregates (AVG, COUNT, and mean of squares to derive std) to compute each baseline; do not eyeball rows.\n- The z-score of a value is (value - mean) / std. A metric is anomalous when its most recent value has an absolute z-score of 2.5 or more AND the baseline has n of at least 5. Fewer than 5 trailing values means the metric is still warming up - never alert on a warming metric.\n- send_alert is for anomalies only. Name the metric, the value, the baseline mean, and the z-score, and say in one plain sentence what direction it moved.\n\nWake notes arrive as plain prompts. A note reading watch means: if watcher_stopped is true, answer stopped and do nothing else. Otherwise, for every distinct metric in the table: compute the trailing 14-day baseline with SQL, store it under baseline:<metric>, score the most recent value, and send_alert for each anomaly. Then call schedule with in set to 1 day and note set to watch. Answer one line per metric: <metric>: z=<z> <ok or ANOMALY>; if every metric is ok, one line saying all quiet is enough.\n\nTasks you receive:\n- start {}: run one watch pass exactly as the watch note describes. This is what kicks off the daily chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to Slack, PagerDuty, or email. Custom tools live
// in source only — never in the manifest.
const sendAlert = {
  name: "send_alert",
  description: "Alert the team about one anomalous metric. Include metric, value, baseline mean, and z-score.",
  params: {
    type: "object",
    properties: {
      metric: { type: "string", description: "The metric name" },
      message: { type: "string", description: "One plain sentence: what moved, which way, how far" },
    },
    required: ["metric", "message"],
  },
  // STUB — wire this to your alerting channel.
  async run({ metric, message }) {
    return { sent: true, metric, message };
  },
};

const agent = new Agent("kpi-anomaly-watcher", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // a daily arithmetic pass must cost pennies
    budgets: { perDayCents: 40 },
  },
  // db for the raw series, memory for baselines and the stop flag,
  // schedule for the daily wake-and-compare chain.
  capabilities: [tools.db, tools.memory, tools.schedule, sendAlert],
});

const METRICS_TABLE = "CREATE TABLE IF NOT EXISTS metrics (id INTEGER PRIMARY KEY AUTOINCREMENT, metric TEXT, value REAL, recorded_at TEXT)";

// record — pure primitives, zero LLM cost: point your product's event
// pipeline here; a million rows never spend a token.
agent.task("record", async (args) => {
  const metric = typeof args.metric === "string" ? args.metric.trim() : "";
  const value = Number(args.value);
  if (metric.length === 0 || !Number.isFinite(value)) {
    throw new Error("record requires { metric, value: number }");
  }
  await agent.db.sql([METRICS_TABLE]);
  await agent.db.sql`INSERT INTO metrics (metric, value, recorded_at) VALUES (${metric}, ${value}, ${new Date().toISOString()})`;
  return "Recorded " + metric + " = " + value + ".";
});

// stop / start — the chain's switches. stop is a zero-LLM flag flip read
// by the next wake (coordination through state).
agent.task("stop", async () => {
  await agent.memory.set("watcher_stopped", true);
  return "Stopped. The pending watch wake will stand down when it fires.";
});

agent.task("start", async () => {
  await agent.memory.set("watcher_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 20,
    maxCost: 0.15,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// baselines — zero-LLM read of every remembered baseline.
agent.task("baselines", async () => {
  const keys = await agent.memory.list("baseline:");
  const out = {};
  for (const key of keys) {
    out[key.slice("baseline:".length)] = await agent.memory.get(key);
  }
  return out;
});

export default agent;
