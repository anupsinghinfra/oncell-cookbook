/**
 * social-scheduler — publishes one queued post a day and rolls up the
 * week's engagement every Sunday. Two clocks, one agent.
 *
 * Scheduling pattern on display: INTERLEAVED CADENCES. Wake notes are a
 * dispatch mechanism: a note reading `publish` re-books itself daily, a
 * note reading `rollup` re-books itself weekly, and the two chains run
 * through the same agent without knowing about each other. You don't need
 * one agent per rhythm — you need one note per rhythm.
 *
 * Deploy:  npm run deploy social-scheduler
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/social-scheduler/queue-post \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"platform": "linkedin", "text": "We just shipped scheduled agents. Thread below."}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are social-scheduler: you keep a social account alive by publishing exactly one queued post per day and writing one honest engagement rollup per week. You never write posts yourself - humans queue them, you time them.\n\nState you own:\n- SQLite table posts(id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT, text TEXT, status TEXT, queued_at TEXT, published_at TEXT, likes INTEGER, replies INTEGER). Create it if it does not exist before any read or write. status is queued or published.\n- Rollup files under rollups/, one per week, named rollups/YYYY-Www.md.\n- Memory key scheduler_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- publish_post sends one post to a platform and returns its id. fetch_engagement returns likes and replies for a published post.\n- You run two independent wake chains distinguished by the note text. Never mix them: a publish wake never writes rollups, a rollup wake never publishes.\n\nWake notes arrive as plain prompts:\n- A note reading publish means: if scheduler_stopped is true, answer stopped and do nothing else. Otherwise take the oldest queued post; if there is none, answer queue empty. If there is one, send it with publish_post, set status to published and published_at to now. Either way, call schedule with in set to 1 day and note set to publish. Answer in one line.\n- A note reading rollup means: if scheduler_stopped is true, answer stopped and do nothing else. Otherwise call fetch_engagement for every post published in the last 7 days, store likes and replies on each row, and write rollups/YYYY-Www.md for the current ISO week: a table of the week's posts with their numbers, the best and worst performer, and one observation about what worked. Then call schedule with in set to 7 days and note set to rollup. Answer in one line with the post count and the best performer.\n\nTasks you receive:\n- start {}: run one publish pass exactly as the publish note describes, then call schedule with in set to 7 days and note set to rollup. This single task arms both chains; answer with one line per chain.";

// ── Custom capabilities ────────────────────────────────────────────────────
// STUB TOOLS: wire these to the X/LinkedIn/Mastodon APIs of your choice.
// Custom tools live in source only — never in the manifest.

const publishPost = {
  name: "publish_post",
  description: "Publish one post to a social platform. Returns the platform post id.",
  params: {
    type: "object",
    properties: {
      platform: { type: "string", description: "Target platform, e.g. linkedin or x" },
      text: { type: "string", description: "The post text, published verbatim" },
    },
    required: ["platform", "text"],
  },
  // STUB — wire this to your social platform API.
  async run({ platform }) {
    return { published: true, platform, post_id: "stub-" + Date.now().toString(36) };
  },
};

const fetchEngagement = {
  name: "fetch_engagement",
  description: "Fetch engagement numbers (likes, replies) for a published post by its platform post id.",
  params: {
    type: "object",
    properties: { post_id: { type: "string", description: "The platform post id returned by publish_post" } },
    required: ["post_id"],
  },
  // STUB — wire this to your social platform analytics API.
  async run({ post_id }) {
    return { post_id, likes: 42, replies: 5 };
  },
};

const agent = new Agent("social-scheduler", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 150 }, // one publish/day + one rollup/week
  },
  // db for the queue, files for the rollups, memory for the stop flag,
  // schedule for both chains. The stubs are the platform.
  capabilities: [tools.db, tools.files, tools.memory, tools.schedule, publishPost, fetchEngagement],
});

const POSTS_TABLE = "CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, platform TEXT, text TEXT, status TEXT, queued_at TEXT, published_at TEXT, likes INTEGER, replies INTEGER)";

// queue-post — pure primitives, zero LLM cost: writers drop posts into the
// queue all day without spending a token or waking a chain.
agent.task("queue-post", async (args) => {
  const platform = typeof args.platform === "string" ? args.platform.trim() : "";
  const text = typeof args.text === "string" ? args.text.trim() : "";
  if (platform.length === 0 || text.length === 0) {
    throw new Error("queue-post requires { platform, text }");
  }
  await agent.db.sql([POSTS_TABLE]);
  await agent.db.sql`INSERT INTO posts (platform, text, status, queued_at) VALUES (${platform}, ${text}, 'queued', ${new Date().toISOString()})`;
  const count = await agent.db.sql`SELECT COUNT(*) AS n FROM posts WHERE status = 'queued'`;
  return "Queued for " + platform + ". " + count.rows[0].n + " post(s) waiting.";
});

// stop / start — one flag stands both chains down; start re-arms both.
agent.task("stop", async () => {
  await agent.memory.set("scheduler_stopped", true);
  return "Stopped. Both the daily publish wake and the weekly rollup wake will stand down when they fire.";
});

agent.task("start", async () => {
  await agent.memory.set("scheduler_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 16,
    maxCost: 0.4,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// queue — zero-LLM read of what is waiting and what went out.
agent.task("queue", async () => {
  await agent.db.sql([POSTS_TABLE]);
  const result = await agent.db.sql`SELECT id, platform, status, queued_at, published_at, likes, replies FROM posts ORDER BY id DESC LIMIT 20`;
  return result.rows;
});

export default agent;
