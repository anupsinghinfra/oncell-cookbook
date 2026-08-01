/**
 * lead-qualifier — scores every inbound lead against your ICP rubric,
 * decides the obvious ones instantly, and parks for a human only on the
 * genuinely borderline.
 *
 * Superpowers on display:
 *   - skills: the ICP rubric is a versioned, diffable procedure — change
 *     your ICP by editing one skill and redeploying.
 *   - ask_human: borderline scores park the run at $0 until sales weighs
 *     in; clear passes and fails never wait.
 *   - db: every verdict lands in SQLite — your lead-scoring audit trail.
 *
 * Deploy:  npm run deploy lead-qualifier
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/lead-qualifier/qualify \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"name": "Priya N", "company": "Meridian Logistics", "email": "priya@meridian.example", "notes": "VP Ops, 800-person fleet, asked about API pricing"}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are lead-qualifier: the first filter between the inbound form and the sales team. Obvious fits get through instantly, obvious misses get filed politely, and only the genuinely borderline cost a human any attention.\n\nState you own:\n- SQLite table leads(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, company TEXT, email TEXT, notes TEXT, score INTEGER, verdict TEXT, reason TEXT, scored_at TEXT). Create it if it does not exist before any read or write.\n\nHow you work:\n- The icp-rubric skill is the scoring procedure - activate it for every lead and follow it exactly. Never invent criteria outside the rubric.\n- Never score the same email twice: if a lead row with this email already exists, answer with the existing verdict instead of re-scoring.\n\nTasks you receive:\n- qualify { name, company, email, notes }: activate icp-rubric, score the lead, record the row, and answer with exactly one line: QUALIFIED, DISQUALIFIED, or ESCALATED, then a dash, the score, a dash, and a one-sentence reason.\n- pipeline {}: read the leads table and answer with three short sections - Qualified, Escalated, Disqualified - each line as name (company): score. Keep it under 20 lines.";

// ── The ICP rubric skill ───────────────────────────────────────────────────
// Your ideal customer profile as a versioned procedure. Edit the criteria,
// redeploy, and the diff is your changelog. While active, tools narrow to
// db + ask_human: score, record, and (rarely) ask - nothing else.
const icpRubric = skill("icp-rubric", {
  description: "Score one inbound lead 0-100 against the ideal customer profile and decide qualified, disqualified, or escalate to a human.",
  instructions: "Scoring rubric - start at 0, add points for each signal:\n- Company fit (0-40): 25 for a company in logistics, field services, or delivery; 15 more when the notes suggest 100 or more vehicles or field workers.\n- Buyer fit (0-30): 30 for a director level or above title in operations or engineering; 15 for a manager; 0 for students, consultants scouting, or no title signal.\n- Intent (0-30): 30 for a concrete question about pricing, integration, or rollout; 15 for a demo request with context; 5 for a bare newsletter-style signup.\nVerdict bands:\n- 70 to 100: QUALIFIED.\n- 0 to 40: DISQUALIFIED.\n- 41 to 69: borderline - call ask_human with one line stating the score and the tension (for example strong intent but tiny fleet). Approved means QUALIFIED, rejected means DISQUALIFIED; use the human reason in your answer.\nAlways insert the lead row with the final verdict, score, and reason before answering.",
  tools: [tools.db, tools.ask_human],
});

const agent = new Agent("lead-qualifier", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day scores a full day of inbound
  },
  capabilities: [tools.db, tools.ask_human],
  skills: [icpRubric],
});

agent.task("qualify", async (args) => {
  // Validate at the boundary — no tokens spent on an empty form post.
  const email = typeof args.email === "string" ? args.email.trim() : "";
  if (email.length === 0) throw new Error("qualify requires { email } (plus name, company, notes)");
  const name = typeof args.name === "string" ? args.name : "unknown";
  const company = typeof args.company === "string" ? args.company : "unknown";
  const notes = typeof args.notes === "string" ? args.notes.slice(0, 2000) : "";

  // Clear fits and clear misses finish in a few steps; borderline leads hit
  // ask_human inside the skill and park at $0 until sales answers.
  const result = await agent.llm(
    "Task: qualify " + JSON.stringify({ name, company, email, notes }),
    { maxSteps: 10, maxCost: 0.25 },
  );
  return { verdict: result.text, status: result.status, cost: result.cost };
});

agent.task("pipeline", async () => {
  const result = await agent.llm("Task: pipeline {}", { maxSteps: 6, maxCost: 0.15 });
  return result.text;
});

export default agent;
