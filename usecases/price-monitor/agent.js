/**
 * price-monitor — watches competitor prices, keeps the full history in
 * SQLite, and only speaks up when a move crosses your threshold.
 *
 * Superpowers on display:
 *   - schedule: the daily check books its own tomorrow — a durable wake
 *     intent, not a cron box.
 *   - db: every observation lands in a real SQLite price history you can
 *     query for free, no LLM in the loop.
 *   - claude-haiku: a watcher that runs every day should cost cents.
 *
 * Deploy:  npm run deploy price-monitor
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/price-monitor/track \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"name": "Acme Pro plan", "url": "https://acme.example/pricing", "threshold_pct": 5}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are price-monitor: a patient watcher of competitor prices. You record every observation, and you only raise your voice when a move actually matters.\n\nState you own - create each table if it does not exist before any read or write:\n- SQLite table products(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, url TEXT, threshold_pct REAL, created_at TEXT).\n- SQLite table prices(id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT, price_usd REAL, checked_at TEXT).\n\nHow you work:\n- fetch_price is your only window to the outside world; it takes a url and returns the current price.\n- A price move matters when the absolute percent change from the most recent recorded price meets or exceeds that product threshold_pct. The first observation for a product never matters - there is nothing to compare against.\n- Wake notes arrive as plain prompts. A note reading check means run the check task.\n\nTasks you receive:\n- track { name, url, threshold_pct }: insert the product (if the name exists, update url and threshold_pct instead) and confirm in one line with the total number of tracked products.\n- check {}: for every product, call fetch_price, insert a row into prices, and compare against the previous price. Then call schedule with in set to 1 day and note set to check. Answer with one line per flagged move formatted as ALERT <name>: <old> -> <new> (<signed percent>), or the single line all quiet - N products checked when nothing crossed a threshold.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: replace `run` with a real fetcher — a scraping API, your own
// crawler behind an HTTP gateway, or a price feed. The sandbox itself has
// no network. Custom tools live in source only — never in the manifest.
const fetchPrice = {
  name: "fetch_price",
  description: "Fetch the current price in USD for a product page URL.",
  params: {
    type: "object",
    properties: { url: { type: "string", description: "The product or pricing page URL" } },
    required: ["url"],
  },
  // STUB — wire this to your scraper or price feed.
  async run({ url }) {
    return { url, price_usd: 49.0, fetched_at: new Date().toISOString() };
  },
};

const agent = new Agent("price-monitor", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // a daily watcher should cost cents, not dollars
    budgets: { perDayCents: 100 },
  },
  // db for the durable price history, schedule so every check books the
  // next one. fetch_price is the stub window to the outside world.
  capabilities: [tools.db, tools.schedule, fetchPrice],
});

agent.task("track", async (args) => {
  // Validate at the boundary — no tokens spent on a malformed product.
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const url = typeof args.url === "string" ? args.url.trim() : "";
  const threshold = Number(args.threshold_pct);
  if (name.length === 0 || url.length === 0 || !Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("track requires { name, url, threshold_pct > 0 }");
  }
  const result = await agent.llm(
    "Task: track " + JSON.stringify({ name, url, threshold_pct: threshold }),
    { maxSteps: 6, maxCost: 0.05 },
  );
  return { reply: result.text, status: result.status, cost: result.cost };
});

/** One check pass over every tracked product; the identity carries the procedure. */
async function runCheck() {
  const result = await agent.llm("Task: check {}", { maxSteps: 20, maxCost: 0.2 });
  return { status: result.status, cost: result.cost, report: result.text };
}

agent.task("check", () => runCheck());

// Belt-and-braces daily trigger; the schedule capability keeps the chain alive.
agent.schedule("daily-price-check", "daily", runCheck, { maxCost: 0.2 });

// history — pure primitives, zero LLM cost: the raw price series for one product.
agent.task("history", async (args) => {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  if (name.length === 0) throw new Error("history requires { name }");
  await agent.db.sql`CREATE TABLE IF NOT EXISTS prices (id INTEGER PRIMARY KEY AUTOINCREMENT, product TEXT, price_usd REAL, checked_at TEXT)`;
  const result = await agent.db.sql`SELECT price_usd, checked_at FROM prices WHERE product = ${name} ORDER BY checked_at`;
  return result.rows;
});

export default agent;
