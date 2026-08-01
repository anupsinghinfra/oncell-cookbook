/**
 * dependency-update-scout — a weekly sweep of your dependency list against
 * the registry, ending in a written upgrade note you can act on Monday.
 *
 * Scheduling pattern on display: the STEADY CADENCE. The simplest durable
 * loop there is — every pass ends by booking the next one 7 days out with
 * a single schedule call. No cron expression, no scheduler host: the chain
 * IS the schedule, and it survives crashes and redeploys because the wake
 * is a ledger entry the runtime owns, not a process that must stay alive.
 *
 * Deploy:  npm run deploy dependency-update-scout
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/dependency-update-scout/set-deps \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"deps": [{"name": "react", "version": "18.3.1"}, {"name": "zod", "version": "3.23.8"}]}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are dependency-update-scout: once a week you compare every dependency you track against the registry and write one upgrade note a busy engineer can act on in ten minutes.\n\nState you own:\n- SQLite table deps(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, current TEXT, latest TEXT, last_checked TEXT). Create it if it does not exist before any read or write.\n- Upgrade notes under notes/, one per review, named notes/YYYY-MM-DD.md.\n- Memory key scout_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- registry_lookup takes a package name and returns the latest version plus a short summary of what changed.\n- A dependency is behind when latest differs from current. Classify each behind dependency: major bump means breaking-change risk, minor or patch means routine. Order the note by risk: majors first with a short why-it-matters, then a routine list.\n\nWake notes arrive as plain prompts. A note reading review means: if scout_stopped is true, answer stopped and do nothing else. Otherwise look up every tracked dependency with registry_lookup, update latest and last_checked in the table, write notes/YYYY-MM-DD.md with sections Breaking-change candidates and Routine bumps (skip empty sections; if nothing is behind, write one line saying all current), then call schedule with in set to 7 days and note set to review. Answer with a one-line count: <n> tracked, <m> behind, note written.\n\nTasks you receive:\n- start {}: run one review pass exactly as the review note describes. This is what kicks off the weekly chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to the npm/PyPI/crates registry API of your stack.
// Custom tools live in source only — never in the manifest.
const registryLookup = {
  name: "registry_lookup",
  description: "Look up a package in the registry: latest version and a one-line summary of recent changes.",
  params: {
    type: "object",
    properties: { name: { type: "string", description: "Package name as published in the registry" } },
    required: ["name"],
  },
  // STUB — wire this to your package registry.
  async run({ name }) {
    return { name, latest: "9.9.9", summary: "stub: security fix in transitive dep, no API changes" };
  },
};

const agent = new Agent("dependency-update-scout", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 75 }, // one weekly pass; the ceiling is slack
  },
  // db for the tracked list, files for the notes, memory for the stop
  // flag, schedule for the weekly self-rebooking chain.
  capabilities: [tools.db, tools.files, tools.memory, tools.schedule, registryLookup],
});

const DEPS_TABLE = "CREATE TABLE IF NOT EXISTS deps (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, current TEXT, latest TEXT, last_checked TEXT)";

// set-deps — pure primitives, zero LLM cost: paste your lockfile summary
// in, no tokens spent, nothing scheduled.
agent.task("set-deps", async (args) => {
  const deps = Array.isArray(args.deps) ? args.deps : [];
  const valid = deps.filter(
    (d) => d && typeof d.name === "string" && d.name.trim().length > 0 && typeof d.version === "string",
  );
  if (valid.length === 0) throw new Error("set-deps requires { deps: [{ name, version }] }");
  await agent.db.sql([DEPS_TABLE]);
  for (const dep of valid) {
    await agent.db.sql`INSERT INTO deps (name, current) VALUES (${dep.name.trim()}, ${dep.version}) ON CONFLICT(name) DO UPDATE SET current = ${dep.version}`;
  }
  return "Tracking " + valid.length + " dependencies. Run start to kick off the weekly review.";
});

// stop / start — the cadence's switches. stop is a zero-LLM flag; the next
// wake reads it and stands down (coordination through state).
agent.task("stop", async () => {
  await agent.memory.set("scout_stopped", true);
  return "Stopped. The pending weekly review will stand down when it wakes.";
});

agent.task("start", async () => {
  await agent.memory.set("scout_stopped", false);
  const result = await agent.llm("Task: start {}. Today is " + new Date().toISOString().slice(0, 10) + ".", {
    maxSteps: 24,
    maxCost: 0.5,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// latest-note — zero-LLM read of the newest upgrade note.
agent.task("latest-note", async () => {
  const names = await agent.files.list("notes");
  if (!Array.isArray(names) || names.length === 0) return "No review notes yet - run start first.";
  const newest = [...names].sort().at(-1);
  const path = newest.startsWith("notes/") ? newest : "notes/" + newest;
  return await agent.files.read(path);
});

export default agent;
