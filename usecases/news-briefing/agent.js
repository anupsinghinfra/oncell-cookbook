/**
 * news-briefing — a daily topical brief whose emphasis drifts toward what
 * you actually read. Feedback nudges per-topic weights; tomorrow's wake
 * reads the new weights and writes a different brief.
 *
 * Scheduling pattern on display: the PREFERENCE-TUNED CADENCE. The clock
 * never changes — one wake a day, forever. What changes is the state the
 * wake consumes: a topic_weights map, adjusted by a zero-LLM feedback
 * task. The cadence provides the repetition; the state provides the
 * learning; the agent between them just reads its dials every morning.
 *
 * Deploy:  npm run deploy news-briefing
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/news-briefing/set-topics \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"topics": ["ai infrastructure", "devtools funding", "kubernetes"]}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are news-briefing: a morning editor with a memory for what your reader actually reads. Every day you compile one brief across their topics, giving more ink to the topics they engage with and less to the ones they skip - without ever silently dropping a topic.\n\nState you own:\n- Memory key topic_weights - JSON mapping topic to weight. Weights start at 1.0 and live between 0.2 and 3.0. Feedback adjusts them outside your loop; you only read them.\n- Brief files under briefs/, one per day, named briefs/YYYY-MM-DD.md.\n- Memory key briefing_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- fetch_headlines takes a topic and returns recent items with title, source, and summary.\n- Ink follows weight: topics at 2.0 or above get a titled section with 3 or 4 items and a synthesis line; topics near 1.0 get 2 items; topics at 0.5 or below get a single one-line mention under a Briefly heading. Every topic in topic_weights appears somewhere - a low weight shrinks a topic, it never silences it, because the reader changes their mind and the brief is where they notice.\n- Lead with the day's most consequential item across all topics, regardless of weight. Editors override dials for news that matters.\n\nWake notes arrive as plain prompts. A note reading brief means: if briefing_stopped is true, answer stopped and do nothing else. Otherwise read topic_weights (no topics set means answer that and do nothing else), call fetch_headlines per topic, write briefs/YYYY-MM-DD.md per the ink rules, then call schedule with in set to 1 day and note set to brief. Answer in one line: brief written, <n> topics, led with <topic>.\n\nTasks you receive:\n- start {}: run one brief pass exactly as the brief note describes. This is what kicks off the daily chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to your news API or RSS aggregator. Custom tools
// live in source only — never in the manifest.
const fetchHeadlines = {
  name: "fetch_headlines",
  description: "Fetch recent items for one topic: title, source, summary.",
  params: {
    type: "object",
    properties: { topic: { type: "string", description: "The topic to fetch headlines for" } },
    required: ["topic"],
  },
  // STUB — wire this to your news source.
  async run({ topic }) {
    return {
      topic,
      items: [
        { title: "Stub headline about " + topic, source: "stubwire", summary: "Two-sentence stub summary." },
      ],
    };
  },
};

const MIN_WEIGHT = 0.2;
const MAX_WEIGHT = 3.0;
const LIKE_FACTOR = 1.25;
const SKIP_FACTOR = 0.8;

const agent = new Agent("news-briefing", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 100 }, // one real editorial pass per day
  },
  // memory for the weight dials and stop flag, files for the briefs,
  // schedule for the daily chain. The stub is the newswire.
  capabilities: [tools.memory, tools.files, tools.schedule, fetchHeadlines],
});

// set-topics — pure primitives, zero LLM cost: declare what you care
// about; every topic starts at weight 1.0. Existing weights survive.
agent.task("set-topics", async (args) => {
  const topics = Array.isArray(args.topics)
    ? args.topics.filter((t) => typeof t === "string" && t.trim().length > 0).map((t) => t.trim().toLowerCase())
    : [];
  if (topics.length === 0) throw new Error("set-topics requires { topics: [string] }");
  const weights = (await agent.memory.get("topic_weights")) ?? {};
  const updated = Object.fromEntries(topics.map((t) => [t, typeof weights[t] === "number" ? weights[t] : 1.0]));
  await agent.memory.set("topic_weights", updated);
  return "Following " + topics.length + " topic(s), all others dropped. Run start to arm the daily brief.";
});

// feedback — pure primitives, zero LLM cost: the learning loop. Liked
// topics gain weight, skipped topics lose it, clamped to [0.2, 3.0].
// Tomorrow's wake reads the new dials; no model is involved in learning.
agent.task("feedback", async (args) => {
  const liked = Array.isArray(args.liked) ? args.liked.map((t) => String(t).trim().toLowerCase()) : [];
  const skipped = Array.isArray(args.skipped) ? args.skipped.map((t) => String(t).trim().toLowerCase()) : [];
  if (liked.length === 0 && skipped.length === 0) {
    throw new Error("feedback requires { liked: [topic] } and/or { skipped: [topic] }");
  }
  const weights = (await agent.memory.get("topic_weights")) ?? {};
  const updated = { ...weights };
  for (const topic of liked) {
    if (typeof updated[topic] === "number") {
      updated[topic] = Math.min(MAX_WEIGHT, updated[topic] * LIKE_FACTOR);
    }
  }
  for (const topic of skipped) {
    if (typeof updated[topic] === "number") {
      updated[topic] = Math.max(MIN_WEIGHT, updated[topic] * SKIP_FACTOR);
    }
  }
  await agent.memory.set("topic_weights", updated);
  return updated;
});

// stop / start — the daily chain's switches; stop is a zero-LLM flag.
agent.task("stop", async () => {
  await agent.memory.set("briefing_stopped", true);
  return "Stopped. The pending morning wake will stand down when it fires.";
});

agent.task("start", async () => {
  await agent.memory.set("briefing_stopped", false);
  const result = await agent.llm("Task: start {}. Today is " + new Date().toISOString().slice(0, 10) + ".", {
    maxSteps: 20,
    maxCost: 0.5,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// latest — zero-LLM read of the newest brief.
agent.task("latest", async () => {
  const names = await agent.files.list("briefs");
  if (!Array.isArray(names) || names.length === 0) return "No briefs yet - set topics and run start.";
  const newest = [...names].sort().at(-1);
  const path = newest.startsWith("briefs/") ? newest : "briefs/" + newest;
  return await agent.files.read(path);
});

export default agent;
