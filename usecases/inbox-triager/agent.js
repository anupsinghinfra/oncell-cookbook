/**
 * inbox-triager — every incoming email gets a label, a priority, and a
 * one-line suggested action. Seconds per email, fractions of a cent.
 *
 * Superpowers on display:
 *   - Skills as packaged procedures: the classification rules and the weekly
 *     rollup are versioned skills, not prompt spaghetti. Only their one-line
 *     descriptions ride in base context; full instructions load on demand.
 *   - Cheap llm-loop classification on claude-haiku, with durable memory:
 *     the agent remembers every sender it has ever seen.
 *
 * Deploy:  npm run deploy inbox-triager
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/inbox-triager/triage \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"from": "billing@vendor.example", "subject": "Invoice overdue", "body": "..."}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are inbox-triager: every incoming email gets a label, a priority, and a one-line suggested action - in seconds, for a fraction of a cent.\n\nLabels: urgent, reply-needed, waiting-on-us, newsletter, notification, spam.\nPriorities: p0 (today), p1 (this week), p2 (whenever).\n\nHow you work:\n- Sender history lives in memory under sender:<address>: keys - read it before judging, update it after. A first-time sender asking for money or credentials is a red flag; a colleague who writes every day is not.\n- The triage-rules skill is the classification procedure; the rollup skill turns your memory into a short report.\n\nTasks you receive:\n- triage { from, subject, body }: activate triage-rules and answer with exactly one line: label | priority | suggested action.\n- rollup {}: activate rollup and produce the report.";

// ── Skills: procedures you version, not prompts you paste ──────────────────

const triageRules = skill("triage-rules", {
  description: "The classification procedure for one email - how to pick the label, the priority, and the suggested action.",
  instructions: "Triage procedure:\n1. Read sender:<address>:seen from memory; treat a missing value as zero. After deciding, write it back incremented and store the label under sender:<address>:last_label.\n2. Pick the label:\n- urgent: real deadlines, outages, unhappy customers, money-critical mail from a known sender.\n- reply-needed: a direct question to us without deadline pressure.\n- waiting-on-us: the thread shows we owe an artifact or a decision.\n- newsletter or notification: bulk or automated mail; when torn between the two, choose notification.\n- spam: unsolicited pitches, or a first-time sender asking for money or credentials.\n3. Priority: urgent is p0; reply-needed and waiting-on-us default to p1; newsletter, notification, and spam are p2.\n4. Suggested action: one imperative sentence a human can execute, like Reply with the invoice, or Archive.\nAnswer with exactly: label | priority | action. No preamble, no explanation.",
  tools: [tools.memory],
});

const rollup = skill("rollup", {
  description: "Turn sender history in memory into a short triage report - top senders, label mix, anything suspicious.",
  instructions: "Rollup procedure:\n1. List memory keys with prefix sender: and read the counts and last labels.\n2. Report three sections, one line per item: Top senders (by count), Label mix (rough proportions), Watchlist (senders whose last label was spam or urgent).\n3. Keep the whole report under 15 lines.",
  tools: [tools.memory],
});

const agent = new Agent("inbox-triager", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // classification does not need a frontier model
    budgets: { perDayCents: 100 }, // $1/day triages hundreds of emails
  },
  capabilities: [tools.memory],
  skills: [triageRules, rollup],
});

agent.task("triage", async (args) => {
  const from = typeof args.from === "string" ? args.from : "";
  const subject = typeof args.subject === "string" ? args.subject : "";
  const body = typeof args.body === "string" ? args.body : "";
  if (from.length === 0 || subject.length === 0) {
    throw new Error("triage requires { from, subject, body }");
  }

  // One cheap loop; the triage-rules skill carries the procedure. Long
  // bodies are clipped — the subject and opening carry the signal.
  const result = await agent.llm(
    "Task: triage " + JSON.stringify({ from, subject, body: body.slice(0, 4000) }),
    { maxSteps: 8, maxCost: 0.05 },
  );

  // Serialized read-modify-write: safe even when two emails land at once.
  await agent.memory.transact("triaged_total", "increment", 1);
  return result.text;
});

agent.task("rollup", async () => {
  const result = await agent.llm("Task: rollup {}", { maxSteps: 8, maxCost: 0.05 });
  return result.text;
});

export default agent;
