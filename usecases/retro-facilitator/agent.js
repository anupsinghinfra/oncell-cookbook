/**
 * retro-facilitator — runs the team retro as a biweekly ritual: opens a
 * collection window, nudges the quiet middle, and synthesizes themes when
 * the window closes. Three moments, one cycle, zero meetings.
 *
 * Scheduling pattern on display: the MULTI-PHASE CYCLE. One logical event
 * (a retro) is spread across three phased wakes — open (day 0), remind
 * (day 4), close (day 7) — each wake booking the NEXT phase, and the last
 * phase booking the next cycle's open. The chain is a state machine whose
 * transitions are wake notes.
 *
 * Deploy:  npm run deploy retro-facilitator
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/retro-facilitator/add-entry \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"author": "sam", "text": "The deploy freeze on Friday saved us; let us keep it"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are retro-facilitator: you run the team retrospective as a rhythm, not a meeting. Each cycle you open a collection window, nudge once in the middle, and close by synthesizing what the team actually said into themes worth acting on.\n\nState you own:\n- SQLite table entries(id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT, text TEXT, cycle INTEGER, created_at TEXT). Create it if it does not exist before any read or write.\n- Memory key current_cycle - the cycle number entries are being collected for, starting at 1.\n- Memory key window_state - open or closed. Entries only land while open.\n- Retro files under retros/, one per cycle, named retros/cycle-<n>.md.\n- Memory key retro_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- post_message is how you speak to the team channel.\n- Synthesis judgment: group entries into 2 to 4 named themes, quote at most one entry per theme verbatim, and end with a Keep / Change / Try section. Attribute nothing to a person in the summary - retro entries are the team speaking, not individuals on record.\n\nWake notes arrive as plain prompts - each phase books the next:\n- A note reading open means: if retro_stopped is true, answer stopped and do nothing else. Otherwise set window_state to open, post_message announcing the window for cycle current_cycle and how to submit, then call schedule with in set to 4 days and note set to remind. Answer in one line.\n- A note reading remind means: if retro_stopped is true, answer stopped and do nothing else. Otherwise count this cycle's entries and post_message a mid-window nudge with the count and days left, then call schedule with in set to 3 days and note set to close. Answer in one line.\n- A note reading close means: if retro_stopped is true, answer stopped and do nothing else. Otherwise set window_state to closed, read this cycle's entries, write retros/cycle-<n>.md per the synthesis judgment (an empty cycle gets a short honest file saying nobody wrote in), post_message the themes with a link line, increment current_cycle, then call schedule with in set to 7 days and note set to open. Answer with the theme names.\n\nTasks you receive:\n- start {}: initialize current_cycle to 1 if unset, then run one open pass exactly as the open note describes. This is what kicks off the biweekly cycle.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to Slack or Teams. Custom tools live in source
// only — never in the manifest.
const postMessage = {
  name: "post_message",
  description: "Post one message to the team channel.",
  params: {
    type: "object",
    properties: {
      text: { type: "string", description: "The message text" },
    },
    required: ["text"],
  },
  // STUB — wire this to your chat platform.
  async run({ text }) {
    return { posted: true, chars: text.length };
  },
};

const agent = new Agent("retro-facilitator", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 75 }, // three light wakes per 14-day cycle
  },
  // db for entries, memory for cycle/window state and the stop flag,
  // files for the synthesized retros, schedule for the phase chain.
  capabilities: [tools.db, tools.memory, tools.files, tools.schedule, postMessage],
});

const ENTRIES_TABLE = "CREATE TABLE IF NOT EXISTS entries (id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT, text TEXT, cycle INTEGER, created_at TEXT)";

// add-entry — pure primitives, zero LLM cost: teammates drop thoughts in
// all week; rejected cleanly when the window is closed.
agent.task("add-entry", async (args) => {
  const author = typeof args.author === "string" ? args.author.trim() : "";
  const text = typeof args.text === "string" ? args.text.trim() : "";
  if (author.length === 0 || text.length === 0) throw new Error("add-entry requires { author, text }");
  const state = await agent.memory.get("window_state");
  if (state === "closed") return "The window for this cycle is closed - your note will have to wait for the next open.";
  const cycle = (await agent.memory.get("current_cycle")) ?? 1;
  await agent.db.sql([ENTRIES_TABLE]);
  await agent.db.sql`INSERT INTO entries (author, text, cycle, created_at) VALUES (${author}, ${text}, ${cycle}, ${new Date().toISOString()})`;
  return "Noted for cycle " + cycle + ". Thank you.";
});

// stop / start — the cycle's switches; stop is a zero-LLM flag read by
// whichever phase wakes next.
agent.task("stop", async () => {
  await agent.memory.set("retro_stopped", true);
  return "Stopped. Whichever phase wake is pending will stand down when it fires.";
});

agent.task("start", async () => {
  await agent.memory.set("retro_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 12,
    maxCost: 0.3,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// latest-retro — zero-LLM read of the newest synthesis.
agent.task("latest-retro", async () => {
  const names = await agent.files.list("retros");
  if (!Array.isArray(names) || names.length === 0) return "No retros yet - the first cycle has not closed.";
  const newest = [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  const path = newest.startsWith("retros/") ? newest : "retros/" + newest;
  return await agent.files.read(path);
});

export default agent;
