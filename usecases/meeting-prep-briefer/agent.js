/**
 * meeting-prep-briefer — every weekday morning, a one-page brief for each
 * meeting on today's calendar. On Friday it books Monday, not Saturday.
 *
 * Scheduling pattern on display: WEEKDAY-ONLY SELF-REBOOKING. A plain
 * "in 1 day" cadence doesn't know about weekends. This agent computes its
 * own next wake as an absolute timestamp — tomorrow at 06:30 UTC, unless
 * tomorrow is Saturday or Sunday, in which case Monday — and books it with
 * `at`. The calendar logic lives in the agent's head; the runtime just
 * honors the instant.
 *
 * Deploy:  npm run deploy meeting-prep-briefer
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/meeting-prep-briefer/add-context \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"name": "Dana Reyes", "note": "CFO at Northwind, cares about integration timelines, met at re:Invent"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are meeting-prep-briefer: every weekday morning you turn today's calendar into a one-page brief so nobody walks into a meeting cold. You do not work weekends, and you are the one who knows that.\n\nState you own:\n- Memory keys person:<name> - a short plain-text note about a person, added by humans over time.\n- Brief files under briefs/, one per weekday, named briefs/YYYY-MM-DD.md.\n- Memory key briefer_stopped - when true, every wake stands down without doing anything.\n\nHow you work:\n- fetch_calendar takes a date (YYYY-MM-DD) and returns that day's meetings: time, title, attendees, and any agenda text.\n- For each meeting write a tight brief: what the meeting is for (from the title and agenda), one line per attendee (pull person:<name> notes where they exist; say unknown otherwise), and one suggested question to open with. No filler.\n- Weekday arithmetic is your job, not the runtime's: after briefing, compute the next weekday morning as an absolute instant. Take today, add one day; if that lands on Saturday add two more, if Sunday add one more. The wake instant is that date at 06:30:00Z, formatted as a full ISO 8601 timestamp.\n\nWake notes arrive as plain prompts. A note reading brief means: if briefer_stopped is true, answer stopped and do nothing else. Otherwise call fetch_calendar for today, write briefs/YYYY-MM-DD.md covering every meeting (a day with no meetings still gets a file with one line saying clear calendar), then call schedule with at set to the computed next weekday 06:30:00Z instant and note set to brief. Answer with one line: <n> meetings briefed, next wake <ISO instant>.\n\nTasks you receive:\n- start {}: run one brief pass exactly as the brief note describes. This is what kicks off the weekday chain.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: wire `run` to Google Calendar or Outlook. Custom tools live
// in source only — never in the manifest.
const fetchCalendar = {
  name: "fetch_calendar",
  description: "Fetch one day's meetings: time, title, attendees, agenda text.",
  params: {
    type: "object",
    properties: { date: { type: "string", description: "The day to fetch, YYYY-MM-DD" } },
    required: ["date"],
  },
  // STUB — wire this to your calendar provider.
  async run({ date }) {
    return {
      date,
      meetings: [
        {
          time: "10:00",
          title: "Northwind renewal sync",
          attendees: ["Dana Reyes", "Sam Okafor"],
          agenda: "Q3 renewal, open integration questions",
        },
      ],
    };
  },
};

const agent = new Agent("meeting-prep-briefer", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 100 }, // one morning pass of real writing
  },
  // memory for people notes and the stop flag, files for the briefs,
  // schedule for the computed weekday-morning wakes.
  capabilities: [tools.memory, tools.files, tools.schedule, fetchCalendar],
});

// add-context — pure primitives, zero LLM cost: build the people file
// one line at a time, no tokens, no chain started.
agent.task("add-context", async (args) => {
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const note = typeof args.note === "string" ? args.note.trim() : "";
  if (name.length === 0 || note.length === 0) throw new Error("add-context requires { name, note }");
  await agent.memory.set("person:" + name, note);
  return "Noted. Briefs mentioning " + name + " will carry this context.";
});

// stop / start — the weekday chain's switches. stop is zero-LLM; the next
// morning's wake reads the flag and stands down.
agent.task("stop", async () => {
  await agent.memory.set("briefer_stopped", true);
  return "Stopped. The pending morning wake will stand down when it fires.";
});

agent.task("start", async () => {
  await agent.memory.set("briefer_stopped", false);
  const result = await agent.llm("Task: start {}. The current time is " + new Date().toISOString() + ".", {
    maxSteps: 16,
    maxCost: 0.4,
  });
  return { report: result.text, status: result.status, cost: result.cost };
});

// today — zero-LLM read of the most recent brief.
agent.task("today", async () => {
  const names = await agent.files.list("briefs");
  if (!Array.isArray(names) || names.length === 0) return "No briefs yet - run start first.";
  const newest = [...names].sort().at(-1);
  const path = newest.startsWith("briefs/") ? newest : "briefs/" + newest;
  return await agent.files.read(path);
});

export default agent;
