/**
 * onboarding-emailer — runs a per-user onboarding sequence: each touch
 * schedules the next one, and users who activate simply stop hearing
 * from it. No campaign engine, no segments, no cron.
 *
 * Superpowers on display:
 *   - memory.forUser: every user gets their own shelf of state — step,
 *     activation, name — with one line of scoping.
 *   - schedule: the sequence is a chain of per-user wake intents; a
 *     thousand users means a thousand independent timelines.
 *   - a zero-LLM kill switch: activated flips one memory key, no model.
 *
 * Deploy:  npm run deploy onboarding-emailer
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/onboarding-emailer/signup \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"user_id": "u_1042", "email": "sam@newco.example", "name": "Sam"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are onboarding-emailer: you run each new user through a short, well-timed email sequence - and you go quiet the moment they activate, because the worst onboarding email is the one sent to someone already onboarded.\n\nThe sequence - one email per step, each under 130 words, warm and concrete, signed by the team:\n- Step 1 (on signup): welcome, one clear first action.\n- Step 2 (2 days later): the single most valuable feature, shown with a concrete example.\n- Step 3 (3 days after step 2): a short customer story with one number in it.\n- Step 4 (4 days after step 3): a check-in asking what is in the way, inviting a reply. This is the last email - the sequence ends here no matter what.\n\nState you own - all under user:<user_id>: keys in memory:\n- user:<user_id>:profile - JSON { email, name }.\n- user:<user_id>:step - the last step sent, 1 to 4.\n- user:<user_id>:activated - true once the product reports activation.\n\nHow you work:\n- send_email is the only way to reach users.\n- Wake notes arrive as plain prompts. A note reading touch <user_id> means: read the user keys. If activated is true or step is 4 or the profile is missing, answer that the sequence is over and send nothing. Otherwise send the next step email with send_email, write the new step, and call schedule with note set to touch <user_id> and in set to the gap before the following step - 2 days after step 1, 3 days after step 2, 4 days after step 3, nothing after step 4.\n\nTasks you receive:\n- signup { user_id, email, name }: if user:<user_id>:step already exists, say so and stop. Otherwise store the profile, send the step 1 welcome, set step to 1, and call schedule with in set to 2 days and note set to touch <user_id>. Answer in one line: started <user_id> at step 1, next touch in 2 days.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: replace `run` with your email provider (SES, Postmark,
// Customer.io transactional). Custom tools live in source only — never in
// the manifest.
const sendEmail = {
  name: "send_email",
  description: "Send one onboarding email to a user. Keep it under 130 words.",
  params: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Subject line" },
      body: { type: "string", description: "Plain-text body" },
    },
    required: ["to", "subject", "body"],
  },
  // STUB — wire this to your transactional email API.
  async run({ to, subject }) {
    return { sent: true, to, subject };
  },
};

const agent = new Agent("onboarding-emailer", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 300 }, // $3/day onboards hundreds of signups
  },
  // memory for per-user sequence state, schedule for each user's own
  // timeline of touches. send_email is the stub outbox.
  capabilities: [tools.memory, tools.schedule, sendEmail],
});

agent.task("signup", async (args) => {
  // Validate at the boundary — no tokens spent on a malformed signup.
  const userId = typeof args.user_id === "string" ? args.user_id.trim() : "";
  const email = typeof args.email === "string" ? args.email.trim() : "";
  if (userId.length === 0 || email.length === 0) {
    throw new Error("signup requires { user_id, email } (name optional)");
  }
  const name = typeof args.name === "string" ? args.name : "there";

  const result = await agent.llm(
    "Task: signup " + JSON.stringify({ user_id: userId, email, name }),
    { maxSteps: 10, maxCost: 0.25 },
  );
  return { reply: result.text, status: result.status, cost: result.cost };
});

// activated — pure primitives, zero LLM cost. Flip one per-user key; every
// future wake for this user reads it and stands down.
agent.task("activated", async (args) => {
  const userId = typeof args.user_id === "string" ? args.user_id.trim() : "";
  if (userId.length === 0) throw new Error("activated requires { user_id }");
  const profile = agent.memory.forUser(userId); // keys become user:<id>:*
  await profile.set("activated", true);
  return "Marked " + userId + " activated - remaining touches will stand down on wake.";
});

// progress — zero-LLM read of one user's sequence state.
agent.task("progress", async (args) => {
  const userId = typeof args.user_id === "string" ? args.user_id.trim() : "";
  if (userId.length === 0) throw new Error("progress requires { user_id }");
  const profile = agent.memory.forUser(userId);
  return {
    step: (await profile.get("step")) ?? null,
    activated: (await profile.get("activated")) === true,
  };
});

export default agent;
