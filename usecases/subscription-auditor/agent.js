/**
 * subscription-auditor — once a month it sweeps the SaaS ledger, names the
 * zombies, and asks a human before drafting a single cancellation.
 *
 * Scheduling pattern on display: the LONG-PERIOD CADENCE. A 30-day wake
 * chain is exactly as cheap and exactly as durable as a 5-minute one — the
 * agent exists for one run a month and is a $0 ledger entry the other 29
 * days. Long periods are where hand-rolled schedulers rot (the quarterly
 * cron nobody remembers owning); a durable wake intent doesn't care how
 * far out it is.
 *
 * Deploy:  npm run deploy subscription-auditor
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/subscription-auditor/upsert-subscription \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"vendor": "Figma", "amount_usd": 540, "cadence": "monthly", "owner": "design"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are subscription-auditor: the monthly conscience of the company card. You find SaaS spend that no longer earns its line item, and you never draft a cancellation without a human saying yes first.\n\nState you own:\n- SQLite table subscriptions(id INTEGER PRIMARY KEY AUTOINCREMENT, vendor TEXT UNIQUE, amount_usd REAL, cadence TEXT, owner TEXT, last_used TEXT, status TEXT). Create it if it does not exist before any read or write. status is active, flagged, or cancelling.\n- Memory key auditor_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- A subscription is a zombie when status is active AND (last_used is empty or older than 60 days, or owner is empty). Compute annual cost as amount_usd times 12 for monthly cadence, times 1 for annual.\n- draft_cancellation writes a cancellation email draft for a vendor; it is gated behind human approval, never called on your own judgment.\n\nWake notes arrive as plain prompts. A note reading audit means: if auditor_stopped is true, answer stopped and do nothing else. Otherwise sweep the table, set status to flagged on every new zombie, and if any subscriptions are flagged, call ask_human once with the full flagged list (vendor, annual cost, owner, days since last use) asking which vendors to draft cancellations for, if any. For each vendor the human approves, call draft_cancellation and set status to cancelling; vendors the human declines go back to active with last_used set to now so they are not re-flagged next month. Then call schedule with in set to 30 days and note set to audit. Answer with total annual spend, the zombie count, and what the human decided.\n\nTasks you receive:\n- start {}: run one audit pass exactly as the audit note describes. This is what kicks off the monthly chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to your email drafts folder or ticketing system.
// Custom tools live in source only — never in the manifest.
const draftCancellation = {
  name: "draft_cancellation",
  description: "Draft a cancellation email for a vendor. Only called after explicit human approval.",
  params: {
    type: "object",
    properties: {
      vendor: { type: "string", description: "The vendor to cancel" },
      body: { type: "string", description: "The cancellation email draft, under 120 words" },
    },
    required: ["vendor", "body"],
  },
  // STUB — wire this to your drafts folder; a human still hits send.
  async run({ vendor }) {
    return { drafted: true, vendor };
  },
};

const agent = new Agent("subscription-auditor", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 50 }, // one real run a month; the ceiling is slack
  },
  // db for the ledger, memory for the stop flag, schedule for the 30-day
  // cadence, ask_human as the gate in front of every cancellation.
  capabilities: [tools.db, tools.memory, tools.schedule, tools.ask_human, draftCancellation],
});

const SUBS_TABLE = "CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, vendor TEXT UNIQUE, amount_usd REAL, cadence TEXT, owner TEXT, last_used TEXT, status TEXT)";

// upsert-subscription — pure primitives, zero LLM cost: sync your ledger
// in from anywhere, no tokens, no chain started.
agent.task("upsert-subscription", async (args) => {
  const vendor = typeof args.vendor === "string" ? args.vendor.trim() : "";
  const amount = Number(args.amount_usd);
  if (vendor.length === 0 || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("upsert-subscription requires { vendor, amount_usd > 0 } (cadence, owner optional)");
  }
  const cadence = args.cadence === "annual" ? "annual" : "monthly";
  const owner = typeof args.owner === "string" ? args.owner.trim() : "";
  await agent.db.sql([SUBS_TABLE]);
  await agent.db.sql`INSERT INTO subscriptions (vendor, amount_usd, cadence, owner, last_used, status) VALUES (${vendor}, ${amount}, ${cadence}, ${owner}, '', 'active') ON CONFLICT(vendor) DO UPDATE SET amount_usd = ${amount}, cadence = ${cadence}, owner = ${owner}`;
  return "Tracking " + vendor + " at $" + amount + "/" + cadence + ". Run start to arm the monthly audit.";
});

// mark-used — zero-LLM: wire your SSO or expense feed here so usage
// signals cost nothing.
agent.task("mark-used", async (args) => {
  const vendor = typeof args.vendor === "string" ? args.vendor.trim() : "";
  if (vendor.length === 0) throw new Error("mark-used requires { vendor }");
  await agent.db.sql([SUBS_TABLE]);
  const result = await agent.db.sql`UPDATE subscriptions SET last_used = ${new Date().toISOString()} WHERE vendor = ${vendor}`;
  return result.changes > 0 ? "Marked " + vendor + " used." : "No subscription " + vendor + " found.";
});

// stop / start — the monthly chain's switches; stop is a zero-LLM flag.
agent.task("stop", async () => {
  await agent.memory.set("auditor_stopped", true);
  return "Stopped. The pending monthly audit will stand down when it wakes.";
});

agent.task("start", async () => {
  await agent.memory.set("auditor_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 20,
    maxCost: 0.5,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// ledger — zero-LLM read of the whole subscription table.
agent.task("ledger", async () => {
  await agent.db.sql([SUBS_TABLE]);
  const result = await agent.db.sql`SELECT vendor, amount_usd, cadence, owner, last_used, status FROM subscriptions ORDER BY amount_usd DESC`;
  return result.rows;
});

export default agent;
