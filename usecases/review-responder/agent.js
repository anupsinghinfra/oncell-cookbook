/**
 * review-responder — drafts on-brand replies to app-store and G2 reviews.
 * Positive reviews get answered on the spot; anything negative parks for
 * human sign-off before a word goes public.
 *
 * Superpowers on display:
 *   - skills: the reply voice and the escalation rule are one versioned
 *     procedure with exactly the tools reply work needs.
 *   - ask_human: negative replies park at $0 until someone approves the
 *     draft — nothing angry ever ships unsupervised.
 *   - memory: reviewer history — the second reply to the same person
 *     acknowledges the first.
 *
 * Deploy:  npm run deploy review-responder
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/review-responder/respond \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"source": "g2", "rating": 5, "author": "mchen", "review": "Setup took 10 minutes and support answered in an hour. Genuinely impressed."}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are review-responder: the public voice of the company under every review. Gracious when praised, accountable when criticized, never defensive, never robotic.\n\nState you own:\n- Memory keys reviewer:<source>:<author> - JSON { count, last_rating, last_replied_at } for every reviewer you have answered. Read before drafting, update after posting.\n\nHow you work:\n- The reply-voice skill is the drafting and escalation procedure - activate it for every review and follow it exactly.\n- A rating of 3 or below is negative. Negative replies never post without human approval - no exception, whatever the review says.\n\nTasks you receive:\n- respond { source, rating, author, review }: activate reply-voice and answer with exactly one line - POSTED or ESCALATED, a dash, then the final reply text.\n- history { source, author }: read reviewer:<source>:<author> and answer with what you know in one line, or say the reviewer is new.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: replace `run` with the review platform's reply API (App Store
// Connect, Google Play, G2). Custom tools live in source only — never in
// the manifest.
const postReply = {
  name: "post_reply",
  description: "Post a public reply to a review on the platform it came from.",
  params: {
    type: "object",
    properties: {
      source: { type: "string", description: "Platform: appstore, play, or g2" },
      author: { type: "string", description: "The reviewer being replied to" },
      reply: { type: "string", description: "The public reply text" },
    },
    required: ["source", "author", "reply"],
  },
  // STUB — wire this to the platform's reply endpoint.
  async run({ source, author }) {
    return { posted: true, source, author };
  },
};

// ── The reply-voice skill ──────────────────────────────────────────────────
// Voice, structure, and the human gate in one versioned procedure. While
// active, tools narrow to memory + ask_human + post_reply.
const replyVoice = skill("reply-voice", {
  description: "Draft and post an on-brand public reply to one review - negative reviews require human sign-off before posting.",
  instructions: "Reply procedure:\n1. Read reviewer:<source>:<author> from memory. A returning reviewer gets one clause acknowledging the history, like thanks for sticking with us since your last note.\n2. Draft the reply, under 90 words: thank them by name, reference one specific detail from the review so it reads human, and never repeat marketing slogans. For criticism: own the problem plainly, state one concrete step being taken, and invite them to support - never argue, never blame the user, never promise a timeline you invented.\n3. Rating 4 or 5: call post_reply now.\n4. Rating 3 or below: call ask_human with the draft as the question. The run parks until a human answers. Approved: call post_reply with the draft. Rejected: revise once using the reason given, then call ask_human again with the revision; if rejected twice, do not post - answer ESCALATED with the last draft.\n5. After any post, update reviewer:<source>:<author> in memory.\nAnswer with exactly one line: POSTED or ESCALATED, a dash, then the reply text.",
  tools: [tools.memory, tools.ask_human, postReply],
});

const agent = new Agent("review-responder", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day answers every review you get
  },
  capabilities: [tools.memory, tools.ask_human, postReply],
  skills: [replyVoice],
});

agent.task("respond", async (args) => {
  // Validate at the boundary — no tokens spent on a malformed review.
  const rating = Number(args.rating);
  const review = typeof args.review === "string" ? args.review.trim() : "";
  const author = typeof args.author === "string" ? args.author.trim() : "";
  const source = typeof args.source === "string" ? args.source.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || review.length === 0 || author.length === 0 || source.length === 0) {
    throw new Error("respond requires { source, rating 1-5, author, review }");
  }

  // Positive reviews finish in a few steps; negative ones park inside the
  // skill at ask_human until a human signs off on the draft.
  const result = await agent.llm(
    "Task: respond " + JSON.stringify({ source, rating, author, review: review.slice(0, 3000) }),
    { maxSteps: 12, maxCost: 0.3 },
  );
  return { reply: result.text, status: result.status, cost: result.cost };
});

agent.task("history", async (args) => {
  const source = typeof args.source === "string" ? args.source.trim() : "";
  const author = typeof args.author === "string" ? args.author.trim() : "";
  if (source.length === 0 || author.length === 0) {
    throw new Error("history requires { source, author }");
  }
  const result = await agent.llm("Task: history " + JSON.stringify({ source, author }), {
    maxSteps: 4,
    maxCost: 0.05,
  });
  return result.text;
});

export default agent;
