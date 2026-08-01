/**
 * faq-builder — feed it support transcripts one at a time; it clusters the
 * recurring questions in SQLite and emits a ranked FAQ whose order is
 * evidence, not opinion.
 *
 * Superpowers on display:
 *   - llm-loop clustering: matching "how do I cancel" to "where do I stop
 *     my subscription" is judgment, and the loop applies it per transcript.
 *   - db: canonical questions and their counts accumulate in SQLite across
 *     hundreds of ingests.
 *   - files: the ranked FAQ is a durable, regenerable artifact.
 *
 * Deploy:  npm run deploy faq-builder
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/faq-builder/ingest \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"transcript": "Customer: How do I cancel my plan?\nAgent: Settings > Billing > Cancel..."}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are faq-builder: you read support transcripts one at a time and grow a ranked FAQ out of what customers actually keep asking. The ranking is counts, never taste.\n\nState you own:\n- SQLite table questions(id INTEGER PRIMARY KEY AUTOINCREMENT, canonical TEXT, variants INTEGER, answer_hint TEXT, last_seen TEXT). Create it if it does not exist before any read or write. canonical is the question phrased the way a customer would ask it; variants counts how many times any phrasing of it has appeared; answer_hint is the best short answer seen so far in the transcripts.\n- The file faq.md - the generated FAQ, rewritten in full on every build.\n\nHow you work:\n- Clustering is judgment: how do I cancel and where do I stop my subscription are the same question; how do I cancel and how do I pause are not. When a transcript question matches an existing canonical, increment variants and improve answer_hint if the transcript answered it better. Otherwise insert a new row with variants 1.\n- Only count real customer questions - ignore agent questions, pleasantries, and one-off account-specific issues that no FAQ could answer.\n\nTasks you receive:\n- ingest { transcript }: extract the customer questions, cluster each into the table as above, and answer with one line per question formatted as matched <canonical> (now N) or new <canonical>.\n- build {}: read the table, order by variants descending, and write faq.md - a title, one line noting it was generated from N clustered questions, then each question as a heading with a 2-4 sentence answer grown from answer_hint. Skip questions with variants 1 unless the table has fewer than 5 rows. Answer with the file content.";

const agent = new Agent("faq-builder", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // per-transcript clustering must stay cheap
    budgets: { perDayCents: 150 },
  },
  // db for the question clusters, files for the generated FAQ.
  capabilities: [tools.db, tools.files],
});

agent.task("ingest", async (args) => {
  // Validate at the boundary — no tokens spent on an empty transcript.
  const transcript = typeof args.transcript === "string" ? args.transcript.trim() : "";
  if (transcript.length < 20) {
    throw new Error("ingest requires { transcript } with at least 20 characters");
  }

  // One cheap loop per transcript. Long transcripts are clipped - the
  // questions cluster within the first chunk of any support conversation.
  const result = await agent.llm(
    "Task: ingest " + JSON.stringify({ transcript: transcript.slice(0, 6000) }),
    { maxSteps: 10, maxCost: 0.08 },
  );
  return { reply: result.text, status: result.status, cost: result.cost };
});

agent.task("build", async () => {
  const result = await agent.llm("Task: build {}", { maxSteps: 10, maxCost: 0.15 });
  return { faq: result.text, status: result.status, cost: result.cost };
});

// top — pure primitives, zero LLM cost: the ranked clusters as raw rows.
agent.task("top", async () => {
  await agent.db.sql`CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, canonical TEXT, variants INTEGER, answer_hint TEXT, last_seen TEXT)`;
  const result = await agent.db.sql`SELECT canonical, variants FROM questions ORDER BY variants DESC LIMIT 20`;
  return result.rows;
});

export default agent;
