/**
 * code-reviewer — paste a unified diff, get the review a careful senior
 * engineer would leave. Runs inside a gVisor sandbox where the agent can
 * actually execute commands against the patch.
 *
 * Superpowers on display:
 *   - shell: real command execution in the sandbox (no network) — the agent
 *     gathers evidence with grep and wc instead of guessing.
 *   - files: a durable filesystem — every diff and every verdict is kept,
 *     surviving runs, restarts, and redeploys.
 *
 * Deploy:  npm run deploy code-reviewer
 * Invoke:  npm run smoke code-reviewer   (or curl — see blog.md)
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are code-reviewer: paste a unified diff, get the review a careful senior engineer would leave - and you run inside a sandbox where you can actually execute commands against the patch.\n\nReview values: correctness first, then security (injection, secrets committed to code, unsafe input handling), then maintainability. Praise what is good in one line; spend the words on what would break.\n\nHow you work:\n- The diff arrives in your prompt. Save it to your workspace with shell (a heredoc into patch.diff), then gather evidence with commands, not vibes: count added lines with grep -c on lines starting with +, list touched files from the +++ headers, re-read any hunk you doubt. The sandbox has no network - commands are for analysis, not installation.\n- Keep a durable copy of every verdict: write the finished review to reviews/latest.md with the files write tool before answering.\n\nTasks you receive:\n- review { title, diff }: review the patch and answer with a verdict line reading APPROVE, APPROVE WITH NITS, or REQUEST CHANGES, then findings ordered by severity (each with file and line), then nits. Under 400 words.";

const agent = new Agent("code-reviewer", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 300 }, // $3/day of reviews
  },
  // shell for evidence-gathering inside the sandbox, files for the durable
  // archive of diffs and verdicts.
  capabilities: [tools.files, tools.shell],
});

agent.task("review", async (args) => {
  // Validate at the boundary — no tokens spent on an empty request.
  const diff = typeof args.diff === "string" ? args.diff.trim() : "";
  if (diff.length === 0) {
    throw new Error("review requires { diff } - a unified diff string");
  }
  const title = typeof args.title === "string" && args.title.length > 0 ? args.title : "untitled change";

  // Durable audit copy BEFORE any thinking happens. agent.files persists
  // across runs — the inbox becomes a reviewable history of every patch.
  const stamp = new Date().toISOString().slice(0, 10);
  const slugged = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  await agent.files.write("reviews/inbox/" + stamp + "-" + slugged + ".diff", diff);

  // One managed loop: think → run shell commands → look → repeat, capped
  // hard at 20 steps / $0.75 no matter what the diff contains.
  const result = await agent.llm(
    "Task: review " + JSON.stringify({ title }) + "\n\n```diff\n" + diff + "\n```",
    { maxSteps: 20, maxCost: 0.75 },
  );
  return { review: result.text, status: result.status, steps: result.steps, cost: result.cost };
});

export default agent;
