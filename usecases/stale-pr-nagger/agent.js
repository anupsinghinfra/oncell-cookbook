/**
 * stale-pr-nagger — a working-hours nag for stale reviews that remembers
 * how much it has nagged each person, and eases off before they mute it.
 *
 * Scheduling pattern on display: the FATIGUE-AWARE CADENCE. The clock is
 * simple — one wake per weekday morning, computed as an absolute `at`
 * instant so weekends are skipped. The pattern lives in what the wake
 * consults before acting: a per-recipient memory of recent nags. A
 * reminder loop without fatigue memory converges on being filtered to a
 * folder; this one rations itself per person, per week.
 *
 * Deploy:  npm run deploy stale-pr-nagger
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/stale-pr-nagger/snooze \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"reviewer": "sam", "days": 3}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are stale-pr-nagger: you keep code reviews moving without becoming the notification everyone filters out. You nag on weekday mornings only, one message per reviewer at most, and you remember how much you have already nagged each person.\n\nState you own:\n- Memory keys nag:<reviewer> - JSON { count, week, last_nagged } tracking nags sent to that reviewer during ISO week <week>. A stored week different from the current ISO week means the counter starts fresh at 0.\n- Memory keys snooze:<reviewer> - an ISO timestamp; never nag that reviewer before it passes.\n- Memory key nagger_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- fetch_open_prs returns every open PR: id, title, author, reviewer, opened_at, last_activity. A PR is stale when last_activity is older than 2 days.\n- send_nag delivers one message to one reviewer. Bundle all of a reviewer's stale PRs into that single message - never send two messages to the same person on the same day.\n- Fatigue rules, checked per reviewer before sending: skip if snooze:<reviewer> is in the future; skip if last_nagged is today; skip if count for the current week is 3 or more. Tone follows the weekly count: first nag of the week is light and friendly, second is a plain list, third opens by acknowledging it is the third ask this week. After sending, update nag:<reviewer>.\n- Weekday arithmetic is yours: the next wake is tomorrow at 09:30:00Z, unless tomorrow is Saturday (add two more days) or Sunday (add one more day).\n\nWake notes arrive as plain prompts. A note reading nag means: if nagger_stopped is true, answer stopped and do nothing else. Otherwise call fetch_open_prs, group stale PRs by reviewer, apply the fatigue rules, send at most one send_nag per eligible reviewer, then call schedule with at set to the computed next weekday 09:30:00Z instant and note set to nag. Answer one line per reviewer: <reviewer>: nagged (<n> PRs) or skipped (<reason>); or all clear if nothing is stale.\n\nTasks you receive:\n- start {}: run one nag pass exactly as the nag note describes. This is what kicks off the weekday chain.";

// ── Custom capabilities ────────────────────────────────────────────────────
// STUB TOOLS: wire these to the GitHub/GitLab API and Slack. Custom tools
// live in source only — never in the manifest.

const fetchOpenPrs = {
  name: "fetch_open_prs",
  description: "List every open PR: id, title, author, reviewer, opened_at, last_activity.",
  params: { type: "object", properties: {} },
  // STUB — wire this to your forge's API.
  async run() {
    return {
      prs: [
        {
          id: 481,
          title: "Add retry to webhook dispatcher",
          author: "priya",
          reviewer: "sam",
          opened_at: "2026-07-27T10:00:00Z",
          last_activity: "2026-07-28T09:00:00Z",
        },
      ],
    };
  },
};

const sendNag = {
  name: "send_nag",
  description: "Send one review reminder to one reviewer, bundling all their stale PRs.",
  params: {
    type: "object",
    properties: {
      reviewer: { type: "string", description: "Who to remind" },
      message: { type: "string", description: "The reminder, tone matched to this week's nag count" },
    },
    required: ["reviewer", "message"],
  },
  // STUB — wire this to Slack DMs or email.
  async run({ reviewer }) {
    return { sent: true, reviewer };
  },
};

const agent = new Agent("stale-pr-nagger", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // a daily list-and-remind pass should cost pennies
    budgets: { perDayCents: 50 },
  },
  // memory for per-reviewer fatigue state and the stop flag, schedule for
  // the weekday-morning chain. The stubs are the forge and the messenger.
  capabilities: [tools.memory, tools.schedule, fetchOpenPrs, sendNag],
});

// snooze — pure primitives, zero LLM cost: a reviewer buys quiet days with
// one call; the next wakes read the timestamp and skip them.
agent.task("snooze", async (args) => {
  const reviewer = typeof args.reviewer === "string" ? args.reviewer.trim() : "";
  const days = Number(args.days);
  if (reviewer.length === 0 || !Number.isFinite(days) || days <= 0 || days > 30) {
    throw new Error("snooze requires { reviewer, days: 1-30 }");
  }
  const until = new Date(Date.now() + days * 86_400_000).toISOString();
  await agent.memory.set("snooze:" + reviewer, until);
  return "Snoozed " + reviewer + " until " + until + ". Wakes before then will skip them.";
});

// stop / start — the weekday chain's switches; stop is a zero-LLM flag.
agent.task("stop", async () => {
  await agent.memory.set("nagger_stopped", true);
  return "Stopped. The pending morning wake will stand down when it fires.";
});

agent.task("start", async () => {
  await agent.memory.set("nagger_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 20,
    maxCost: 0.15,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// fatigue — zero-LLM read of the per-reviewer nag ledger.
agent.task("fatigue", async () => {
  const keys = await agent.memory.list("nag:");
  const out = {};
  for (const key of keys) {
    out[key.slice("nag:".length)] = await agent.memory.get(key);
  }
  return out;
});

export default agent;
