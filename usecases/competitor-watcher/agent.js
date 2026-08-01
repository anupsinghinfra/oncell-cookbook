/**
 * competitor-watcher — reads competitor changelogs and pricing pages every
 * day, diffs them against what it remembered, and reports only what
 * actually changed. Silence means nothing happened.
 *
 * Superpowers on display:
 *   - memory: a durable snapshot of every watched page — the baseline that
 *     turns "here is the page" into "here is what changed".
 *   - schedule: the daily sweep books its own tomorrow.
 *   - custom-tool stub: fetch_page stands in for your fetcher; the sandbox
 *     has no network of its own.
 *
 * Deploy:  npm run deploy competitor-watcher
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/competitor-watcher/watch \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"name": "acme-changelog", "url": "https://acme.example/changelog"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are competitor-watcher: a quiet analyst who reads competitor pages every day and speaks only when something changed. Your value is the diff, never the page.\n\nState you own:\n- Memory keys page:<name> - JSON { url } for each watched page.\n- Memory keys snapshot:<name> - your last structured summary of that page: the notable claims, prices, features, and dated entries, condensed to under 200 words. This is the baseline you diff against.\n\nHow you work:\n- fetch_page is your only window to the web; it takes a url and returns the page text.\n- For each page: fetch, summarize the current content the same structured way, compare against snapshot:<name>, and note anything added, removed, or reworded in a way that changes meaning - new changelog entries, price moves, renamed plans, new feature claims. Cosmetic rewording is not a change. Always write the fresh summary back to snapshot:<name> after comparing.\n- A page with no stored snapshot is a new watch: record the baseline and report it as baseline captured, not as changes.\n- Wake notes arrive as plain prompts. A note reading sweep means run the sweep task.\n\nTasks you receive:\n- watch { name, url }: store page:<name> (overwrite if present) and confirm in one line with the total number of watched pages.\n- sweep {}: process every watched page as above, then call schedule with in set to 1 day and note set to sweep. Answer with one section per page that changed - the page name, then 1 to 3 bullets on what changed and why it might matter - or the single line no changes across N pages when nothing did.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: replace `run` with your fetcher — a scraping API or a proxy
// with network access. The sandbox itself has no network. Custom tools
// live in source only — never in the manifest.
const fetchPage = {
  name: "fetch_page",
  description: "Fetch the readable text content of a URL.",
  params: {
    type: "object",
    properties: { url: { type: "string", description: "The page URL to fetch" } },
    required: ["url"],
  },
  // STUB — wire this to your scraping API.
  async run({ url }) {
    return { url, text: "Changelog\n2026-07-30 - Improved export performance.\nPricing: Starter $29, Pro $79.", fetched_at: new Date().toISOString() };
  },
};

const agent = new Agent("competitor-watcher", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day sweeps a whole competitive landscape
  },
  // memory for baselines, schedule for the self-booking daily sweep.
  // fetch_page is the stub window to the web.
  capabilities: [tools.memory, tools.schedule, fetchPage],
});

agent.task("watch", async (args) => {
  // Validate at the boundary — no tokens spent on a malformed watch.
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const url = typeof args.url === "string" ? args.url.trim() : "";
  if (name.length === 0 || url.length === 0) {
    throw new Error("watch requires { name, url }");
  }
  const result = await agent.llm("Task: watch " + JSON.stringify({ name, url }), {
    maxSteps: 6,
    maxCost: 0.1,
  });
  return { reply: result.text, status: result.status, cost: result.cost };
});

/** One sweep over every watched page; the identity carries the diff rules. */
async function runSweep() {
  const result = await agent.llm("Task: sweep {}", { maxSteps: 20, maxCost: 0.6 });
  return { status: result.status, cost: result.cost, digest: result.text };
}

agent.task("sweep", () => runSweep());

// Belt-and-braces daily trigger; the schedule capability keeps the chain alive.
agent.schedule("daily-sweep", "daily", runSweep, { maxCost: 0.6 });

// baselines — pure primitives, zero LLM cost: what the watcher currently remembers.
agent.task("baselines", async () => {
  const keys = await agent.memory.list("snapshot:");
  const out = {};
  for (const key of keys) {
    out[key.slice("snapshot:".length)] = await agent.memory.get(key);
  }
  return out;
});

export default agent;
