/**
 * meeting-scheduler — negotiates a meeting time over email, parking at $0
 * between every counter-proposal. One run can span a week of back-and-forth
 * and survive any number of deploys in the middle.
 *
 * Superpowers on display:
 *   - ask_human as a relay: after each proposal email, the run parks until
 *     the organizer pastes the counterpart's reply into the dashboard —
 *     the negotiation is ONE run with multiple parks, not a state machine.
 *   - memory: every negotiation's history survives alongside the parks.
 *
 * smokeTask is null on purpose: every invocation parks on a human.
 *
 * Deploy:  npm run deploy meeting-scheduler
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/meeting-scheduler/schedule-meeting \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"meeting_id": "m-podcast", "with": "jordan@guestco.example", "topic": "podcast recording", "duration_min": 45}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are meeting-scheduler: a patient negotiator who books one meeting over email, however many rounds it takes. You never double-book the organizer and you never lose the thread, no matter how long the counterpart takes to reply.\n\nState you own:\n- Memory keys meeting:<meeting_id> - JSON { with, topic, duration_min, status, proposals, agreed_slot }. status is negotiating, booked, or abandoned. Update it after every round.\n\nHow you work:\n- check_calendar returns the organizer's free slots for the coming two weeks; propose only slots it returned.\n- send_email is how you write to the counterpart: short, warm, and always containing 2 or 3 concrete options with day, date, time, and timezone.\n- After every email you send, call ask_human with the question reply from <with>? - paste their response, or answer reject to abandon. The run parks at zero cost until the organizer relays the reply. When it arrives: if the counterpart picked a slot, confirm it by email, set status booked with agreed_slot, and finish. If they proposed different times, call check_calendar again, pick the closest workable options, and send the next round. If they declined outright or the organizer answers reject, set status abandoned, send a graceful closing note, and finish.\n- Give up gracefully after 4 rounds of proposals: suggest the counterpart send their availability instead, mark status abandoned, and finish.\n\nTasks you receive:\n- schedule-meeting { meeting_id, with, topic, duration_min }: if meeting:<meeting_id> exists with status booked or negotiating, say so and stop. Otherwise record the meeting as negotiating, run the negotiation as above, and when it ends answer with one line: BOOKED <agreed_slot> or ABANDONED - <reason>.";

// ── Custom capabilities ────────────────────────────────────────────────────
// STUB TOOLS: point check_calendar at your calendar API and send_email at
// your email provider. Custom tools live in source only — never in the
// manifest.

const checkCalendar = {
  name: "check_calendar",
  description: "List the organizer's free slots for the next two weeks.",
  params: {
    type: "object",
    properties: {
      duration_min: { type: "number", description: "Required slot length in minutes" },
    },
    required: ["duration_min"],
  },
  // STUB — wire this to Google Calendar / Outlook free-busy.
  async run({ duration_min }) {
    return {
      duration_min,
      free_slots: [
        "Tue 2026-08-04 10:00-12:00 PT",
        "Wed 2026-08-05 14:00-16:00 PT",
        "Fri 2026-08-07 09:00-11:00 PT",
      ],
    };
  },
};

const sendEmail = {
  name: "send_email",
  description: "Send an email to the meeting counterpart.",
  params: {
    type: "object",
    properties: {
      to: { type: "string", description: "Recipient email address" },
      subject: { type: "string", description: "Subject line" },
      body: { type: "string", description: "Plain-text body" },
    },
    required: ["to", "subject", "body"],
  },
  // STUB — wire this to your email provider.
  async run({ to, subject }) {
    return { sent: true, to, subject };
  },
};

const agent = new Agent("meeting-scheduler", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day negotiates several meetings
  },
  // memory for negotiation state, ask_human as the reply relay. The two
  // stubs are the calendar and the outbox.
  capabilities: [tools.memory, tools.ask_human, checkCalendar, sendEmail],
});

agent.task("schedule-meeting", async (args) => {
  // Validate at the boundary — no tokens spent on a malformed request.
  const meetingId = typeof args.meeting_id === "string" ? args.meeting_id.trim() : "";
  const counterpart = typeof args.with === "string" ? args.with.trim() : "";
  const duration = Number(args.duration_min);
  if (meetingId.length === 0 || counterpart.length === 0 || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("schedule-meeting requires { meeting_id, with, topic, duration_min > 0 }");
  }
  const topic = typeof args.topic === "string" ? args.topic : "a meeting";

  // ONE run for the whole negotiation. Generous step room because each
  // round is propose → park (at $0, possibly for days) → read → repeat.
  const result = await agent.llm(
    "Task: schedule-meeting " + JSON.stringify({ meeting_id: meetingId, with: counterpart, topic, duration_min: duration }),
    { maxSteps: 30, maxCost: 1.0 },
  );
  return { outcome: result.text, status: result.status, cost: result.cost };
});

// negotiations — pure primitives, zero LLM cost: state of every meeting.
agent.task("negotiations", async () => {
  const keys = await agent.memory.list("meeting:");
  const out = {};
  for (const key of keys) {
    out[key.slice("meeting:".length)] = await agent.memory.get(key);
  }
  return out;
});

export default agent;
