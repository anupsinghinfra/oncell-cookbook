/**
 * release-notes-writer — paste a commit log, get customer-facing release
 * notes in your house style. The agent surveys the log with real shell
 * commands before it writes a word.
 *
 * Superpowers on display:
 *   - shell: grep and wc against the saved log — the notes are grounded in
 *     counted evidence, not skimmed vibes.
 *   - skills: the house style (grouping, tone, what to hide) is one
 *     versioned procedure.
 *   - files: every release's notes accumulate under release-notes/.
 *
 * Deploy:  npm run deploy release-notes-writer
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/release-notes-writer/write \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"version": "v2.14.0", "commits": "feat: bulk export to CSV\nfix: crash on empty search\nchore: bump deps"}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are release-notes-writer: you translate engineer-speak commit logs into release notes a customer actually wants to read. Features become benefits, fixes become reassurance, and internal plumbing disappears.\n\nState you own:\n- Files under release-notes/, one per release, named release-notes/<version>.md.\n- The incoming commit log for the current run is saved at worklog/commits.txt before you start reading.\n\nHow you work:\n- Survey before writing: use shell against worklog/commits.txt to count commits (wc -l), count each conventional type (grep -c on feat:, fix:, perf:, chore:), and list anything unprefixed. Ground the notes in what you counted - never claim more changes than the log contains.\n- The house-style skill is the writing procedure - activate it for every release and follow it exactly.\n\nTasks you receive:\n- write { version, commits }: survey the saved log, activate house-style, write release-notes/<version>.md, and answer with the finished notes verbatim.\n- changelog {}: return the sorted list of paths under release-notes/, no commentary.";

// ── The house-style skill ──────────────────────────────────────────────────
// Your release-notes voice as a versioned procedure. While active, tools
// narrow to files + shell: read the log, write the notes, nothing else.
const houseStyle = skill("house-style", {
  description: "The house style for customer-facing release notes: grouping, tone, benefit-first phrasing, and what never appears.",
  instructions: "House style:\n- Structure: a one-line release summary, then sections New, Improved, and Fixed - omit any empty section. End with an Under the hood line only when performance or reliability work is worth telling customers about.\n- Every bullet is benefit-first: what the user can now do or stop worrying about, not what the code does. Rewrite feat: add bulk CSV export as Export your entire workspace to CSV in one click.\n- Fixes are reassurance, not confession: name the symptom that is gone, skip the root cause. Never include stack traces, internal ticket ids, or blame.\n- Hide entirely: chore commits, dependency bumps, refactors, CI changes, anything a customer cannot perceive. If that leaves nothing, say this release focuses on stability behind the scenes.\n- Length: the whole document under 250 words. Plain language, present tense, no exclamation marks.\nProcedure: draft the notes from the surveyed log, write them to release-notes/<version>.md with the files write tool, then answer with the notes verbatim.",
  tools: [tools.files, tools.shell],
});

const agent = new Agent("release-notes-writer", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day covers even a release-happy team
  },
  capabilities: [tools.files, tools.shell],
  skills: [houseStyle],
});

agent.task("write", async (args) => {
  // Validate at the boundary — no tokens spent without a real log.
  const version = typeof args.version === "string" ? args.version.trim() : "";
  const commits = typeof args.commits === "string" ? args.commits.trim() : "";
  if (version.length === 0 || commits.length === 0) {
    throw new Error("write requires { version, commits }");
  }

  // Save the log BEFORE the loop starts - the shell survey needs a file to
  // grep, and the archive keeps the raw input alongside the polished output.
  await agent.files.write("worklog/commits.txt", commits);

  const result = await agent.llm(
    "Task: write " + JSON.stringify({ version }) + "\n\nThe commit log is saved at worklog/commits.txt (" + commits.split("\n").length + " lines).",
    { maxSteps: 14, maxCost: 0.5 },
  );
  return { notes: result.text, status: result.status, cost: result.cost };
});

// changelog — pure primitives, zero LLM cost: every release ever written.
agent.task("changelog", async () => {
  const names = await agent.files.list("release-notes");
  return Array.isArray(names) ? names.sort() : [];
});

export default agent;
