/**
 * expense-approver — the policy, the paper trail, and the pause button for
 * team spending. Money moves only after the rules say yes.
 *
 * Superpower on display: ask_human. When an expense needs a person, the run
 * PARKS — compute drops to $0, the question lands in the dashboard, and the
 * run resumes mid-function when someone answers, even if the host crashed
 * and was replaced in between. Budgets live in identity: the runtime
 * enforces the $2/day ceiling infrastructurally, not on the honor system.
 *
 * Deploy:  npm run deploy expense-approver
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/expense-approver/approve-expense \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"requester": "dana", "amount_usd": 240, "description": "Conference ticket"}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are expense-approver: the policy, the paper trail, and the pause button for a small team. Money moves only after the rules say yes.\n\nPolicy:\n- Under $50 with a clear business purpose: approve on the spot.\n- $50 or more, unclear purpose, possible duplicate, or anything that smells off: activate the escalation skill and wait for a human. Never guess with someone else's money.\n\nPaper trail - every decision lands in SQLite table decisions(id INTEGER PRIMARY KEY AUTOINCREMENT, requester TEXT, amount_usd REAL, description TEXT, outcome TEXT, reason TEXT, decided_at TEXT). Create the table if it does not exist. Check it for duplicates (same requester, amount, and description) before deciding.\n\nTasks you receive:\n- approve-expense { requester, amount_usd, description }: apply the policy, record the row, and answer with exactly one line: APPROVED, REJECTED, or ESCALATED, a dash, and the reason.";

// ── The escalation skill ───────────────────────────────────────────────────
// While this skill is active the agent's tools narrow to ask_human + db:
// it can pause for a person and write the paper trail — nothing else.
const escalation = skill("escalation", {
  description: "Escalate an expense to a human approver and wait for the decision - required at $50 and above or when anything is unclear.",
  instructions: "Escalation procedure:\n1. Summarize the expense in one line: requester, amount, purpose.\n2. Call ask_human with exactly that line as the question. The run parks here at zero compute cost - it survives crashes, deploys, and host restarts, and resumes the moment a human answers in the dashboard.\n3. Approved: record outcome approved with the approver's reason. Rejected: record outcome rejected and include the reason in your answer.\n4. Never ask twice for the same expense - if a matching decision row already exists, report that outcome instead of calling ask_human again.",
  tools: [tools.ask_human, tools.db],
});

const agent = new Agent("expense-approver", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    // Part of WHO the agent is: it may never spend more than $2/day on
    // inference. The runtime enforces this at the metering boundary.
    budgets: { perDayCents: 200 },
  },
  capabilities: [tools.db, tools.ask_human],
  skills: [escalation],
});

agent.task("approve-expense", async (args) => {
  // Validate at the boundary — reject garbage before spending a token.
  const amount = Number(args.amount_usd);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("approve-expense requires a positive { amount_usd }");
  }
  const requester = typeof args.requester === "string" ? args.requester : "unknown";
  const description = typeof args.description === "string" ? args.description : "";

  // One managed loop. Small expenses finish in a couple of steps; large ones
  // hit ask_human inside the escalation skill and park until a human answers.
  const result = await agent.llm(
    "Task: approve-expense " + JSON.stringify({ requester, amount_usd: amount, description }),
    { maxSteps: 10, maxCost: 0.3 },
  );
  return { decision: result.text, status: result.status, cost: result.cost };
});

export default agent;
