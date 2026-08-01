/**
 * invoice-chaser — politely escalating payment reminders that sleep between
 * nudges at $0 and stand down the moment payment lands.
 *
 * Superpowers on display:
 *   - schedule: each nudge books the next one 7 days out as a durable wake
 *     intent — the chase survives crashes, deploys, and dead hosts.
 *   - db + a zero-LLM task: payment-received flips one SQLite row with no
 *     model in the loop; the next wake reads it and stands down.
 *   - ask_human: after three nudges the agent stops and asks a person
 *     before doing anything drastic.
 *
 * Deploy:  npm run deploy invoice-chaser
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/invoice-chaser/chase \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"invoice_ref": "INV-2041", "customer": "Blue Harbor LLC", "email": "ap@blueharbor.example", "amount_usd": 1800}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are invoice-chaser: politely relentless accounts receivable. You never sound angry, never forget an invoice, and never send a collections threat without a human saying yes.\n\nState you own:\n- SQLite table invoices(id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_ref TEXT UNIQUE, customer TEXT, email TEXT, amount_usd REAL, status TEXT, nudge_count INTEGER, created_at TEXT). Create it if it does not exist before any read or write. status is open, paid, or escalated.\n\nTone ladder by nudge_count: 1 is a warm nudge assuming good faith, 2 is a firm reminder naming the amount and the days outstanding, 3 is a final notice stating what happens next. Every email stays under 120 words and names the invoice_ref and amount. Never send a fourth email without a human.\n\nWake notes arrive as plain prompts. A note reading nudge <invoice_ref> means: read the row. If status is not open, answer that the chase is over and do nothing else. Otherwise, if nudge_count is 3 or more, call ask_human asking whether to hand this invoice to collections - on approval send a short handoff notice email and set status to escalated; on rejection set status to escalated and note the reason. Otherwise send the next email on the tone ladder with send_email, increment nudge_count, and call schedule with in set to 7 days and note set to nudge <invoice_ref>.\n\nTasks you receive:\n- chase { invoice_ref, customer, email, amount_usd }: if the ref already exists, say so and stop. Otherwise insert the row with status open and nudge_count 0, send the first warm nudge with send_email, set nudge_count to 1, and call schedule with in set to 7 days and note set to nudge <invoice_ref>. Answer in one line: chasing <invoice_ref>, next nudge in 7 days.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: replace `run` with your email provider (SES, Postmark, ...).
// Custom tools live in source only — never in the manifest.
const sendEmail = {
  name: "send_email",
  description: "Send an email to a customer. Keep it under 120 words.",
  params: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Subject line" },
      body: { type: "string", description: "Plain-text body" },
    },
    required: ["to", "subject", "body"],
  },
  // STUB — wire this to your transactional email API.
  async run({ to, subject }) {
    return { sent: true, to, subject };
  },
};

const agent = new Agent("invoice-chaser", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day chases a lot of invoices
  },
  // db for the ledger of chases, schedule for the 7-day sleep between
  // nudges, ask_human as the gate before anything drastic.
  capabilities: [tools.db, tools.schedule, tools.ask_human, sendEmail],
});

const INVOICES_TABLE = "CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY AUTOINCREMENT, invoice_ref TEXT UNIQUE, customer TEXT, email TEXT, amount_usd REAL, status TEXT, nudge_count INTEGER, created_at TEXT)";

agent.task("chase", async (args) => {
  // Validate at the boundary — no tokens spent on a malformed chase.
  const ref = typeof args.invoice_ref === "string" ? args.invoice_ref.trim() : "";
  const email = typeof args.email === "string" ? args.email.trim() : "";
  const amount = Number(args.amount_usd);
  if (ref.length === 0 || email.length === 0 || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("chase requires { invoice_ref, customer, email, amount_usd > 0 }");
  }
  const customer = typeof args.customer === "string" ? args.customer : "unknown";

  const result = await agent.llm(
    "Task: chase " + JSON.stringify({ invoice_ref: ref, customer, email, amount_usd: amount }),
    { maxSteps: 12, maxCost: 0.3 },
  );
  return { reply: result.text, status: result.status, cost: result.cost };
});

// payment-received — pure primitives, zero LLM cost. Flip the row; the next
// scheduled wake reads status paid and stands down on its own.
agent.task("payment-received", async (args) => {
  const ref = typeof args.invoice_ref === "string" ? args.invoice_ref.trim() : "";
  if (ref.length === 0) throw new Error("payment-received requires { invoice_ref }");
  await agent.db.sql([INVOICES_TABLE]);
  const result = await agent.db.sql`UPDATE invoices SET status = 'paid' WHERE invoice_ref = ${ref} AND status = 'open'`;
  return result.changes > 0
    ? "Marked " + ref + " paid. The scheduled nudge will stand down when it wakes."
    : "No open invoice " + ref + " found - nothing to do.";
});

// status — zero-LLM read of the whole chase ledger.
agent.task("status", async () => {
  await agent.db.sql([INVOICES_TABLE]);
  const result = await agent.db.sql`SELECT invoice_ref, customer, amount_usd, status, nudge_count FROM invoices ORDER BY created_at DESC`;
  return result.rows;
});

export default agent;
