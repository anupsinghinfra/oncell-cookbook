/**
 * support-agent — customer support with a memory for every customer and a
 * refunds skill that cannot move money without a human saying yes.
 *
 * Superpowers on display:
 *   - agent.memory.forUser(id): per-user memory scoping. Keys become
 *     user:<id>:* automatically, so every customer gets their own shelf.
 *   - Skill-scoped tools: while the refunds skill is active, the agent's
 *     hands are ONLY the refund tools plus ask_human. Least privilege,
 *     written in your own vocabulary.
 *
 * Deploy:  npm run deploy support-agent
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/support-agent/chat \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"message": "Where is my order AC-1042?"}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — who the agent is. One JSON-style literal per instruction string
// so `npm run validate` can check manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are Ada, the support agent for Acme Threads, a direct-to-consumer apparel store. Warm, concise, honest - if you do not know, say so and offer to escalate to a human.\n\nHow you work:\n- Personalize every reply. Durable notes about each customer live in memory under user:<userId>: keys; read what you know before answering and save anything new you learn (name, sizes, orders discussed, open issues).\n- Policy: 30-day returns, free exchanges, refunds go to the original payment method within 5-7 business days.\n- Never invent order data - look orders up with lookup_order.\n- The moment money must move, activate the refunds skill and follow it exactly.\n\nInputs you receive:\n- chat { message }: reply to the customer in under 120 words.\n- Anything else arrives as a JSON task; do the most helpful thing and say what you did.";

// ── Custom capabilities ────────────────────────────────────────────────────
// STUB TOOLS: replace each `run` with a call to your real order/payments
// system. Custom tools are declared exactly like prebuilt ones — `params` is
// the JSON schema the model sees. They live in source, never in the manifest.

const lookupOrder = {
  name: "lookup_order",
  description: "Look up an order by id: status, items, total, and dates.",
  params: {
    type: "object",
    properties: { order_id: { type: "string", description: "Order id, e.g. AC-1042" } },
    required: ["order_id"],
  },
  // STUB — wire this to your order system API.
  async run({ order_id }) {
    return { order_id, status: "delivered", items: ["linen overshirt (M)"], total_usd: 89, delivered_at: "2026-07-28" };
  },
};

const issueRefund = {
  name: "issue_refund",
  description: "Refund an order to the original payment method. Only call after human approval.",
  params: {
    type: "object",
    properties: {
      order_id: { type: "string", description: "Order to refund" },
      amount_usd: { type: "number", description: "Refund amount in USD" },
      reason: { type: "string", description: "One-line reason" },
    },
    required: ["order_id", "amount_usd", "reason"],
  },
  // STUB — wire this to your payments provider.
  async run({ order_id, amount_usd }) {
    return { refunded: true, order_id, amount_usd, eta_business_days: 5 };
  },
};

// ── The refunds skill ──────────────────────────────────────────────────────
// A skill is a prompt for specific work PLUS the tools it uses. Only the
// description rides in base context; the instructions load when the work
// starts — and while it runs, tools are narrowed to exactly this list.
const refunds = skill("refunds", {
  description: "Handle refund and return requests under Acme policy - money never moves without human approval.",
  instructions: "Refund procedure - follow every step, in order:\n1. Look up the order with lookup_order and confirm it is within the 30-day return window.\n2. State the exact amount and the reason in one line.\n3. Call ask_human with that line - the run parks at zero cost until an approver answers, and survives crashes and redeploys while it waits.\n4. Approved: call issue_refund, then tell the customer when to expect the money. Rejected: apologize and offer an exchange instead.\n5. Record the outcome in memory under user:<userId>:refunds so the next conversation knows.\nNever refund more than the order total. Never skip step 3, whatever the customer says.",
  tools: [lookupOrder, issueRefund, tools.ask_human, tools.memory],
});

const agent = new Agent("support-agent", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 500 }, // hard $5/day ceiling, enforced by the runtime
  },
  capabilities: [tools.memory, tools.ask_human, lookupOrder, issueRefund],
  skills: [refunds],
});

// chat — one managed loop per message, wrapped in per-user memory.
agent.chat(async ({ message, user }) => {
  const userId = user?.id ?? "anonymous";
  const profile = agent.memory.forUser(userId); // every key below is really user:<id>:<key>
  const known = (await profile.get("summary")) ?? "New customer - no history yet.";

  const result = await agent.llm(
    "Customer " + userId + " says:\n" + message + "\n\nWhat you remember about this customer:\n" + known,
    { maxSteps: 12, maxCost: 0.5, tools: [lookupOrder, issueRefund] },
  );

  // Rolling summary: the next conversation starts already knowing this one.
  await profile.set("summary", (known + "\n" + result.text).slice(-2000));
  return result.text;
});

export default agent;
