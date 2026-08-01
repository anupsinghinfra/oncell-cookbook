/**
 * content-repurposer — one blog post in, a thread, a LinkedIn post, and a
 * newsletter blurb out. The voice rules are a skill, so every channel
 * sounds like you — not like a model.
 *
 * Superpowers on display:
 *   - skills: the house voice is a versioned procedure with per-channel
 *     rules, loaded only when repurposing work starts.
 *   - files: every derivative is archived under repurposed/<slug>/ — a
 *     durable content library that outlives runs and redeploys.
 *
 * Deploy:  npm run deploy content-repurposer
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/content-repurposer/repurpose \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"title": "Why we killed our microservices", "post": "Three years ago we split the monolith..."}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are content-repurposer: you turn one finished blog post into channel-native derivatives - a thread, a LinkedIn post, and a newsletter blurb - that each sound like the author, not like a summary.\n\nState you own:\n- Files under repurposed/<post-slug>/ where <post-slug> is the title lowercased with non-alphanumerics collapsed to hyphens. Each run writes thread.md, linkedin.md, and newsletter.md there.\n\nHow you work:\n- The voice-rules skill carries the house voice and the per-channel formats - activate it for every repurpose and follow it exactly.\n- Derive, never invent: every claim in a derivative must exist in the source post. If the post is too thin for a channel, say so in that file instead of padding.\n\nTasks you receive:\n- repurpose { title, post }: activate voice-rules, write the three files, and answer with the three file paths followed by the first line of each derivative.\n- list {}: return the paths of everything under repurposed/ grouped by post slug, no commentary.";

// ── The voice skill ────────────────────────────────────────────────────────
// The house voice as a versioned procedure. Edit the rules, redeploy, and
// every future derivative shifts tone together. While active, tools narrow
// to files: read nothing else, write nowhere else.
const voiceRules = skill("voice-rules", {
  description: "House voice and per-channel formats for turning one blog post into a thread, a LinkedIn post, and a newsletter blurb.",
  instructions: "Voice - all channels:\n- First person, plain words, short sentences. No hashtags, no emoji, no hype adjectives like game-changing.\n- Lead with the most surprising concrete detail in the post, never with a definition.\n\nThread (thread.md):\n- 6 to 10 numbered tweets, each under 280 characters. Tweet 1 is a hook stating the outcome or tension; the last tweet links back to the post with one line of takeaway.\n\nLinkedIn (linkedin.md):\n- 120 to 200 words, 2 to 4 short paragraphs. Open on the professional lesson. One question to the reader at the end. No listicle formatting.\n\nNewsletter blurb (newsletter.md):\n- 40 to 70 words, written as a personal recommendation of the post, ending with Read on: <title>.\n\nProcedure: write each file under repurposed/<post-slug>/ with the files write tool, then answer with the paths and first lines.",
  tools: [tools.files],
});

const agent = new Agent("content-repurposer", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 300 }, // $3/day repurposes a healthy publishing cadence
  },
  capabilities: [tools.files],
  skills: [voiceRules],
});

agent.task("repurpose", async (args) => {
  // Validate at the boundary — no tokens spent without a real post.
  const title = typeof args.title === "string" ? args.title.trim() : "";
  const post = typeof args.post === "string" ? args.post.trim() : "";
  if (title.length === 0 || post.length < 100) {
    throw new Error("repurpose requires { title, post } with at least 100 characters of post");
  }

  // One managed loop: the voice-rules skill carries formats and tone. Long
  // posts are clipped - 12k characters carries the argument of any post.
  const result = await agent.llm(
    "Task: repurpose " + JSON.stringify({ title, post: post.slice(0, 12000) }),
    { maxSteps: 12, maxCost: 0.6 },
  );
  return { reply: result.text, status: result.status, cost: result.cost };
});

// list — pure primitives, zero LLM cost: the content library index.
agent.task("list", async () => {
  const names = await agent.files.list("repurposed");
  return Array.isArray(names) ? names.sort() : [];
});

export default agent;
