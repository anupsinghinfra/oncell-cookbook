/**
 * cert-expiry-sentinel — nothing in your certs table expires as a surprise.
 * Escalating warnings at 30, 7, and 1 days out, each fired by a wake
 * computed to land at exactly the right instant.
 *
 * Scheduling pattern on display: the DEADLINE COUNTDOWN. Most schedulers
 * think in cadences ("every day"); this agent thinks in absolute time. It
 * computes each cert's next threshold instant (expires_at minus 30/7/1
 * days) and books a wake with `at` set to that ISO timestamp. The weekly
 * scan is just the surveyor that plants those precise wakes.
 *
 * Deploy:  npm run deploy cert-expiry-sentinel
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/cert-expiry-sentinel/add-cert \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"domain": "api.myapp.example", "kind": "tls-cert", "expires_at": "2026-11-15T00:00:00Z"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are cert-expiry-sentinel: nothing in your certs table expires as a surprise. You warn at 30 days, 7 days, and 1 day before every expiry, each warning more urgent than the last.\n\nState you own:\n- SQLite table certs(id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT UNIQUE, kind TEXT, expires_at TEXT, warned_level INTEGER, status TEXT). Create it if it does not exist before any read or write. status is active or retired. warned_level is the tightest threshold already warned for: 0 means none yet, then 30, 7, 1.\n- Memory key sentinel_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- send_alert is how warnings reach people. severity is notice at 30 days, warning at 7 days, critical at 1 day or past expiry. Always name the domain and the exact expiry date.\n- The due level for a cert is 1 if it expires within 1 day, else 7 if within 7 days, else 30 if within 30 days, else none. Warn only when the due level is tighter than warned_level (with 0 meaning nothing warned yet), then set warned_level to the due level.\n- The countdown is exact, not a cadence: the next threshold instant for a cert is expires_at minus its next unwarned threshold in days. When that instant falls within the coming 7 days, call schedule with at set to that exact ISO timestamp and note set to check <domain>.\n\nWake notes arrive as plain prompts:\n- A note reading scan means: if sentinel_stopped is true, answer stopped and do nothing else. Otherwise walk every active cert, apply the warning rule, plant a check <domain> wake for each cert whose next threshold instant is within 7 days, then call schedule with in set to 7 days and note set to scan. Answer one line per cert: <domain>: <days> days left, <warned or quiet>.\n- A note reading check <domain> means: if sentinel_stopped is true, answer stopped and do nothing else. Read the row; if it is missing or status is not active, answer stood down. Otherwise recompute days left from the current expires_at (a renewal moves it, which silently invalidates old countdown wakes - that is by design), apply the warning rule, and if a tighter threshold instant is within 7 days plant its check wake. Answer one line.\n\nTasks you receive:\n- start {}: run one scan pass exactly as the scan note describes. This is what kicks off the weekly chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to PagerDuty, Slack, or email. Custom tools live
// in source only — never in the manifest.
const sendAlert = {
  name: "send_alert",
  description: "Warn the owning team about an approaching expiry. severity: notice, warning, or critical.",
  params: {
    type: "object",
    properties: {
      severity: { type: "string", description: "notice (30d), warning (7d), or critical (1d/expired)" },
      message: { type: "string", description: "One line naming the domain and the exact expiry date" },
    },
    required: ["severity", "message"],
  },
  // STUB — wire this to your alerting channel.
  async run({ severity, message }) {
    return { sent: true, severity, message };
  },
};

const agent = new Agent("cert-expiry-sentinel", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 50 }, // one weekly scan + a few countdown wakes
  },
  // db for the certs table, memory for the stop flag, schedule for both
  // the weekly scan and the computed-instant countdown wakes.
  capabilities: [tools.db, tools.memory, tools.schedule, sendAlert],
});

const CERTS_TABLE = "CREATE TABLE IF NOT EXISTS certs (id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT UNIQUE, kind TEXT, expires_at TEXT, warned_level INTEGER, status TEXT)";

// add-cert — pure primitives, zero LLM cost: the ingest path never spends
// a token and never schedules anything (that is what `start` is for).
agent.task("add-cert", async (args) => {
  const domain = typeof args.domain === "string" ? args.domain.trim() : "";
  const expiresAt = typeof args.expires_at === "string" ? args.expires_at.trim() : "";
  if (domain.length === 0 || Number.isNaN(Date.parse(expiresAt))) {
    throw new Error("add-cert requires { domain, expires_at: ISO timestamp } (kind optional)");
  }
  const kind = typeof args.kind === "string" ? args.kind : "tls-cert";
  await agent.db.sql([CERTS_TABLE]);
  await agent.db.sql`INSERT OR REPLACE INTO certs (domain, kind, expires_at, warned_level, status) VALUES (${domain}, ${kind}, ${expiresAt}, 0, 'active')`;
  return "Watching " + domain + " until " + expiresAt + ". Run start to arm the countdown.";
});

// renewed — zero-LLM: a new expiry resets the countdown. Any old computed
// wake for this domain finds a date it no longer matches and stands down.
agent.task("renewed", async (args) => {
  const domain = typeof args.domain === "string" ? args.domain.trim() : "";
  const expiresAt = typeof args.expires_at === "string" ? args.expires_at.trim() : "";
  if (domain.length === 0 || Number.isNaN(Date.parse(expiresAt))) {
    throw new Error("renewed requires { domain, expires_at: ISO timestamp }");
  }
  await agent.db.sql([CERTS_TABLE]);
  const result = await agent.db.sql`UPDATE certs SET expires_at = ${expiresAt}, warned_level = 0 WHERE domain = ${domain}`;
  return result.changes > 0
    ? "Renewed " + domain + " to " + expiresAt + " - the countdown restarts from the new date."
    : "No cert " + domain + " found.";
});

// stop / start — the chain's off and on switches. stop is a zero-LLM flag
// flip; every pending wake reads it and stands down (coordination through
// state, not cancellation).
agent.task("stop", async () => {
  await agent.memory.set("sentinel_stopped", true);
  return "Stopped. Pending scan and countdown wakes will stand down when they fire.";
});

agent.task("start", async () => {
  await agent.memory.set("sentinel_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 24,
    maxCost: 0.4,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// list — zero-LLM read of the whole watch table.
agent.task("list", async () => {
  await agent.db.sql([CERTS_TABLE]);
  const result = await agent.db.sql`SELECT domain, kind, expires_at, warned_level, status FROM certs ORDER BY expires_at ASC`;
  return result.rows;
});

export default agent;
