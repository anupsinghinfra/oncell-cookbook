/**
 * seo-rank-tracker — logs every keyword's search position daily for
 * pennies, then spends real thought once a week on what the lines mean.
 *
 * Scheduling pattern on display: TWO-SPEED TELEMETRY. A fine-grained
 * ingest cadence (daily position logging — mechanical, haiku-cheap) and a
 * coarse analysis cadence (weekly trend report) run as separate wake
 * chains over the same table. Sampling and sense-making are different
 * jobs on different clocks; conflating them is why most dashboards are
 * either stale or noisy.
 *
 * Deploy:  npm run deploy seo-rank-tracker
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/seo-rank-tracker/track \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"keyword": "durable agent runtime"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are seo-rank-tracker: a patient observer of search positions. Daily you log where every tracked keyword ranks; weekly you read the week of lines and say what actually moved and what it means.\n\nState you own:\n- SQLite table keywords(id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT UNIQUE, added_at TEXT). Create it if it does not exist before any read or write.\n- SQLite table positions(id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT, position INTEGER, checked_at TEXT). Create it if it does not exist before any read or write. position 0 means not found in the top 100.\n- Report files under reports/, one per ISO week, named reports/YYYY-Www.md.\n- Memory key tracker_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- serp_lookup takes a keyword and returns its current position for your site.\n- Trend judgment for the weekly report: compare each keyword's latest position to 7 days earlier; a move of 3 or more spots is worth a line, a move into or out of the top 10 is worth a highlighted line, everything else is a table row. Never dramatize a 1-spot wiggle.\n\nWake notes arrive as plain prompts:\n- A note reading check means: if tracker_stopped is true, answer stopped and do nothing else. Otherwise call serp_lookup for every tracked keyword and insert one positions row per keyword with the current timestamp, then call schedule with in set to 1 day and note set to check. Answer in one line: <n> keywords logged.\n- A note reading trend means: if tracker_stopped is true, answer stopped and do nothing else. Otherwise write reports/YYYY-Www.md for the current ISO week per the trend judgment, with movers first and the full table after, then call schedule with in set to 7 days and note set to trend. Answer with the biggest riser and the biggest faller.\n\nTasks you receive:\n- start {}: run one check pass exactly as the check note describes, then call schedule with in set to 7 days and note set to trend. This arms both the daily logger and the weekly report; answer with one line per chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to a SERP API (DataForSEO, Serpapi, ...). Custom
// tools live in source only — never in the manifest.
const serpLookup = {
  name: "serp_lookup",
  description: "Look up the current search position of one keyword for your site. 0 means not in the top 100.",
  params: {
    type: "object",
    properties: { keyword: { type: "string", description: "The keyword to check" } },
    required: ["keyword"],
  },
  // STUB — wire this to your SERP data provider.
  async run({ keyword }) {
    return { keyword, position: 12 };
  },
};

const agent = new Agent("seo-rank-tracker", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // the daily loop is mechanical; keep it at pennies
    budgets: { perDayCents: 60 },
  },
  // db for keywords and the position series, files for weekly reports,
  // memory for the stop flag, schedule for both chains.
  capabilities: [tools.db, tools.files, tools.memory, tools.schedule, serpLookup],
});

const KEYWORDS_TABLE = "CREATE TABLE IF NOT EXISTS keywords (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT UNIQUE, added_at TEXT)";
const POSITIONS_TABLE = "CREATE TABLE IF NOT EXISTS positions (id INTEGER PRIMARY KEY AUTOINCREMENT, keyword TEXT, position INTEGER, checked_at TEXT)";

// track — pure primitives, zero LLM cost: add keywords without spending
// a token or starting a chain.
agent.task("track", async (args) => {
  const keyword = typeof args.keyword === "string" ? args.keyword.trim().toLowerCase() : "";
  if (keyword.length === 0) throw new Error("track requires { keyword }");
  await agent.db.sql([KEYWORDS_TABLE]);
  await agent.db.sql`INSERT OR IGNORE INTO keywords (keyword, added_at) VALUES (${keyword}, ${new Date().toISOString()})`;
  const count = await agent.db.sql`SELECT COUNT(*) AS n FROM keywords`;
  return "Tracking '" + keyword + "'. " + count.rows[0].n + " keyword(s) total. Run start to arm the chains.";
});

// stop / start — one flag stands both chains down; start re-arms both.
agent.task("stop", async () => {
  await agent.memory.set("tracker_stopped", true);
  return "Stopped. The pending check and trend wakes will stand down when they fire.";
});

agent.task("start", async () => {
  await agent.memory.set("tracker_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 24,
    maxCost: 0.2,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// history — zero-LLM read: the raw series for one keyword.
agent.task("history", async (args) => {
  const keyword = typeof args.keyword === "string" ? args.keyword.trim().toLowerCase() : "";
  if (keyword.length === 0) throw new Error("history requires { keyword }");
  await agent.db.sql([POSITIONS_TABLE]);
  const result = await agent.db.sql`SELECT position, checked_at FROM positions WHERE keyword = ${keyword} ORDER BY checked_at DESC LIMIT 30`;
  return result.rows;
});

export default agent;
