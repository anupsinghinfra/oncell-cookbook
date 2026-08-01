/**
 * daily-digest — a quiet chief of staff that compiles one crisp morning
 * briefing from everything the team logged, then schedules its own tomorrow.
 *
 * Superpower on display: durable time. The `schedule` capability records a
 * wake intent in the runtime's park ledger — the agent costs $0 while it
 * waits, and the wake survives crashes, redeploys, and host replacement.
 * No cron box, no queue, no worker to babysit.
 *
 * Deploy:  npm run deploy daily-digest
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/daily-digest/add-note \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"text": "Shipped the new checkout flow to 10% of users"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are daily-digest, a quiet chief of staff. Every morning you compile one crisp briefing from everything the team logged since the last digest.\n\nState you own:\n- SQLite table notes(id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created_at TEXT NOT NULL). Create it if it does not exist before any read or write.\n- Memory key last_digest_at - ISO timestamp of the last digest you wrote.\n- Digest files under digests/, one per day, named digests/YYYY-MM-DD.md.\n\nTasks you receive:\n- add-note { text }: insert the note with the current ISO timestamp and confirm in one short line. Do not write a digest.\n- digest {}: read every note created after last_digest_at, write digests/YYYY-MM-DD.md for today with sections Highlights, Decisions, Follow-ups (crisp bullets, no filler), set last_digest_at to now, then call schedule with in set to 1 day and note set to digest - that one call is what makes you a daily habit instead of a one-off script. Quiet day with no new notes: still write the file, say it was quiet, still schedule tomorrow.\n- latest {}: return the newest digest file verbatim.";

const agent = new Agent("daily-digest", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day is plenty for one briefing + notes
  },
  // db for the notes log, files for the digests, memory for the watermark,
  // schedule so the agent can own its own tomorrow.
  capabilities: [tools.memory, tools.db, tools.files, tools.schedule],
});

/** One digest pass: a single managed loop; the identity carries the procedure. */
async function runDigest() {
  const result = await agent.llm(
    "Task: digest {}. Today is " + new Date().toISOString().slice(0, 10) + ".",
    { maxSteps: 16, maxCost: 0.5 },
  );
  return { status: result.status, cost: result.cost, summary: result.text };
}

// Kick off the habit: "digest" runs once, ends by scheduling tomorrow's run.
agent.task("digest", () => runDigest());

// The SDK's cron surface registers the same pass daily as a belt-and-braces
// trigger; the schedule capability above is what keeps the chain alive.
agent.schedule("morning-digest", "daily", runDigest, { maxCost: 0.5 });

agent.task("add-note", async (args) => {
  const text = typeof args.text === "string" ? args.text.trim() : "";
  if (text.length === 0) throw new Error("add-note requires { text }");
  const result = await agent.llm("Task: add-note " + JSON.stringify({ text }), {
    maxSteps: 16,
    maxCost: 0.5,
  });
  return { status: result.status, cost: result.cost, reply: result.text };
});

// latest — pure primitives, zero LLM cost: read the newest digest directly.
agent.task("latest", async () => {
  const names = await agent.files.list("digests");
  if (!Array.isArray(names) || names.length === 0) {
    return "No digests yet - invoke the digest task first.";
  }
  const newest = [...names].sort().at(-1);
  const path = newest.startsWith("digests/") ? newest : "digests/" + newest;
  return await agent.files.read(path);
});

export default agent;
