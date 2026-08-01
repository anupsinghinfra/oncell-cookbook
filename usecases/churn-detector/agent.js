/**
 * churn-detector — product-usage events stream in as zero-token SQLite
 * inserts; once a week a churn rubric scores every account and flags the
 * ones drifting toward the exit.
 *
 * Superpowers on display:
 *   - db + a zero-LLM ingest path: the event firehose never touches the
 *     model — inserts are free at any volume.
 *   - skills: the churn rubric is a versioned scoring procedure your CS
 *     team can read, diff, and tune.
 *   - schedule: the weekly scoring pass books its own next week.
 *
 * Deploy:  npm run deploy churn-detector
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/churn-detector/event \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"account": "acme", "type": "login"}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are churn-detector: you watch product-usage events accumulate and, once a week, tell the customer success team which accounts are drifting toward the exit - while there is still time to act.\n\nState you own:\n- SQLite table events(id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT, type TEXT, at TEXT). Rows are inserted by the event task without you; treat the table as read-only input. Event types include login, feature_use, invite, export, support_ticket, billing_failure, seat_removed.\n- SQLite table scores(id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT, score INTEGER, band TEXT, reasons TEXT, scored_at TEXT). Create it if it does not exist; append one row per account per scoring pass - never overwrite history.\n\nHow you work:\n- The churn-rubric skill is the scoring procedure - activate it for every scoring pass and follow it exactly.\n- Wake notes arrive as plain prompts. A note reading score means run the score task.\n\nTasks you receive:\n- score {}: activate churn-rubric, score every account that has any event in the last 30 days, append the rows, then call schedule with in set to 7 days and note set to score. Answer with the at-risk accounts ordered by score descending, one line each as <account>: <score> (<band>) - <top reason>, or the single line all healthy - N accounts scored when nothing is at risk.\n- risky {}: read the most recent scoring pass from the scores table and answer with the accounts in the at-risk band, same line format, no re-scoring.";

// ── The churn-rubric skill ─────────────────────────────────────────────────
// The scoring model as a procedure CS can read and tune. While active,
// tools narrow to db: read events, write scores, nothing else.
const churnRubric = skill("churn-rubric", {
  description: "Score each account 0-100 for churn risk from its last 30 days of events, with bands and named reasons.",
  instructions: "Churn scoring - per account, over its last 30 days of events, start at 0 and add:\n- Silence (0-40): 40 if no login in 14 or more days; 20 if logins fell by half or more versus the prior 30 days; 0 when steady.\n- Shrinkage (0-30): 15 per seat_removed event, capped at 30.\n- Friction (0-20): 10 per billing_failure; 5 per support_ticket; capped at 20.\n- Disengagement (0-10): 10 if there are zero feature_use, invite, and export events; 5 if there are no invite and no export events; else 0.\nBands: 0-39 healthy, 40-69 watch, 70-100 at-risk.\nReasons: name the top contributing signals concretely, like no login in 19 days or 2 billing failures - never vague phrases like low engagement.\nAppend one scores row per account with the band and a comma-separated reasons string, then report as the task requires.",
  tools: [tools.db],
});

const agent = new Agent("churn-detector", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // one weekly pass leaves huge headroom
  },
  // db for events and score history, schedule for the weekly cadence.
  capabilities: [tools.db, tools.schedule],
  skills: [churnRubric],
});

const EVENTS_TABLE = "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT, type TEXT, at TEXT)";

// event — pure primitives, zero LLM cost. Point your product analytics
// pipeline here: ingestion is free at any volume.
agent.task("event", async (args) => {
  const account = typeof args.account === "string" ? args.account.trim() : "";
  const type = typeof args.type === "string" ? args.type.trim() : "";
  if (account.length === 0 || type.length === 0) {
    throw new Error("event requires { account, type }");
  }
  await agent.db.sql([EVENTS_TABLE]);
  const now = new Date().toISOString();
  await agent.db.sql`INSERT INTO events (account, type, at) VALUES (${account}, ${type}, ${now})`;
  return { recorded: true, account, type };
});

/** One weekly scoring pass; the churn-rubric skill carries the math. */
async function runScore() {
  const result = await agent.llm(
    "Task: score {}. Today is " + new Date().toISOString().slice(0, 10) + ".",
    { maxSteps: 20, maxCost: 0.6 },
  );
  return { status: result.status, cost: result.cost, report: result.text };
}

agent.task("score", () => runScore());

// Belt-and-braces weekly trigger; the schedule capability keeps the chain alive.
agent.schedule("weekly-churn-score", "weekly", runScore, { maxCost: 0.6 });

agent.task("risky", async () => {
  const result = await agent.llm("Task: risky {}", { maxSteps: 6, maxCost: 0.1 });
  return result.text;
});

export default agent;
