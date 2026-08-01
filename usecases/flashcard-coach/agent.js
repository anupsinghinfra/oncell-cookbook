/**
 * flashcard-coach — spaced repetition where every card owns its own
 * timeline. Rate a card well and its next review recedes into next month;
 * blow it and the card comes back in ten minutes. A 500-card deck is 500
 * independent wake chains, each pacing itself to your memory.
 *
 * Scheduling pattern on display: PER-ITEM WAKE CHAINS — the scheduling
 * flagship of this collection. There is no deck-level cadence at all. Each
 * card's review computes that card's next due instant from its own
 * performance (a simplified SM-2) and books a wake with `at` set to it and
 * note `review <id>`. The schedule isn't a loop over the data; the
 * schedule IS the data, one durable chain per row.
 *
 * Deploy:  npm run deploy flashcard-coach
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/flashcard-coach/add-card \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"front": "What does the schedule tool record?", "back": "A durable wake intent - the runtime owns time and wakes the agent with the note as a fresh prompt"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are flashcard-coach: a patient spaced-repetition tutor. You never quiz on a schedule; every card earns its own next review time from how well its owner actually remembered it.\n\nState you own:\n- SQLite table cards(id INTEGER PRIMARY KEY AUTOINCREMENT, front TEXT, back TEXT, ease REAL, interval_days REAL, due_at TEXT, reps INTEGER, lapses INTEGER, status TEXT, chained INTEGER). Create it if it does not exist before any read or write. status is active or retired. chained is 1 while the card has a pending review wake, 0 otherwise - it exists so start never double-books a chain.\n- Memory key coach_stopped - when true, review wakes stand down (and set their card's chained to 0) instead of quizzing.\n\nGrading - a simplified SM-2, applied after every review:\n- Grade below 3 (forgot): set reps to 0, add 1 to lapses, reduce ease by 0.2 but never below 1.3, and set interval_days to 0.007 (about ten minutes) - forgotten cards come back almost immediately.\n- Grade 3 or more (remembered): add 1 to reps; interval_days becomes 1 for reps 1, 3 for reps 2, otherwise the previous interval_days times ease; then adjust ease by 0.1 minus (5 - grade) times (0.08 + (5 - grade) times 0.02), never below 1.3.\n- After grading: set due_at to now plus interval_days, keep chained at 1, and call schedule with at set to due_at and note set to review <id>. Each card books only its own next wake - never another card's.\n\nWake notes arrive as plain prompts. A note reading review <id> means: read the card. If coach_stopped is true or the card is missing or retired, set its chained to 0 (when it exists) and answer stood down - the chain for this card ends here until start rebuilds it. Otherwise call ask_human with the card front, telling the owner to recall the answer before peeking, then showing the back below a SPOILER line, and asking for a grade 0 to 5. Apply the grading rules to the reply. Answer in one line: card <id>, grade <g>, next review in <interval>.\n\nTasks you receive:\n- start {}: for every active card with chained 0, set chained to 1 and call schedule with note set to review <id> and at set to its due_at if that is in the future, otherwise in set to 1 minute. Cards already chained are left alone. Answer with how many chains you started and how many were already running.";

const agent = new Agent("flashcard-coach", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 150 }, // a heavy review day stays under $1.50
  },
  // db for the deck, memory for the stop flag, schedule for one wake
  // chain per card, ask_human for the review conversation itself.
  capabilities: [tools.db, tools.memory, tools.schedule, tools.ask_human],
});

const CARDS_TABLE = "CREATE TABLE IF NOT EXISTS cards (id INTEGER PRIMARY KEY AUTOINCREMENT, front TEXT, back TEXT, ease REAL, interval_days REAL, due_at TEXT, reps INTEGER, lapses INTEGER, status TEXT, chained INTEGER)";

// add-card — pure primitives, zero LLM cost, and deliberately does NOT
// schedule anything: building a deck must never start wake chains.
// `start` is the explicit switch that arms them.
agent.task("add-card", async (args) => {
  const front = typeof args.front === "string" ? args.front.trim() : "";
  const back = typeof args.back === "string" ? args.back.trim() : "";
  if (front.length === 0 || back.length === 0) throw new Error("add-card requires { front, back }");
  await agent.db.sql([CARDS_TABLE]);
  await agent.db.sql`INSERT INTO cards (front, back, ease, interval_days, due_at, reps, lapses, status, chained) VALUES (${front}, ${back}, 2.5, 0, ${new Date().toISOString()}, 0, 0, 'active', 0)`;
  const count = await agent.db.sql`SELECT COUNT(*) AS n FROM cards WHERE status = 'active'`;
  return "Card added. Deck has " + count.rows[0].n + " active card(s). Run start to arm their review chains.";
});

// retire — zero-LLM: the card's pending wake reads status retired, clears
// chained, and its chain ends. No cancellation API needed.
agent.task("retire", async (args) => {
  const id = Number(args.id);
  if (!Number.isInteger(id) || id <= 0) throw new Error("retire requires { id }");
  await agent.db.sql([CARDS_TABLE]);
  const result = await agent.db.sql`UPDATE cards SET status = 'retired' WHERE id = ${id}`;
  return result.changes > 0
    ? "Retired card " + id + ". Its pending review will stand down when it wakes."
    : "No card " + id + " found.";
});

// stop / start — stop flips one flag; every card's next wake reads it,
// clears its own chained bit, and ends its chain. start rebuilds only the
// chains that are down (chained 0), so it is always safe to call.
agent.task("stop", async () => {
  await agent.memory.set("coach_stopped", true);
  return "Stopped. Each card's pending review will stand down and unchain when it wakes.";
});

agent.task("start", async () => {
  await agent.memory.set("coach_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 40,
    maxCost: 0.5,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// deck — zero-LLM read: every card's own clock, visible at a glance.
agent.task("deck", async () => {
  await agent.db.sql([CARDS_TABLE]);
  const result = await agent.db.sql`SELECT id, front, ease, interval_days, due_at, reps, lapses, status, chained FROM cards ORDER BY due_at ASC`;
  return result.rows;
});

export default agent;
