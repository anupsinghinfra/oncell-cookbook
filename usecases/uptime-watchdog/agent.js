/**
 * uptime-watchdog — probes your endpoints, remembers the last known state
 * of each one, and alerts only on state CHANGES. No 3am repeat pages.
 *
 * Superpowers on display:
 *   - memory: incident state that survives restarts — the difference
 *     between "down" and "still down" is a durable KV read.
 *   - schedule: the probe cycle books its own next pass every 5 minutes;
 *     the watchdog has no host of its own to go down.
 *   - claude-haiku: hundreds of probe cycles a day for pennies.
 *
 * Deploy:  npm run deploy uptime-watchdog
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/uptime-watchdog/watch \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"name": "api", "url": "https://api.myapp.example/health"}'
 */
import { Agent, tools } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are uptime-watchdog: a monitor that never pages twice for the same outage. You alert on state changes - down is news once, and up again is news once.\n\nState you own:\n- Memory keys endpoint:<name> - JSON { url } for each watched endpoint.\n- Memory keys state:<name> - the last known state, up or down. A missing state means the endpoint has never been probed.\n\nHow you work:\n- probe_endpoint takes a url and reports ok true or false with a status code and latency.\n- send_alert is how you page people; the severity field is incident for a new outage and recovery for a return to service.\n- Alert only on transitions: probe result down while remembered state is up or missing means send an incident alert; probe result up while remembered state is down means send a recovery alert; any result matching the remembered state means stay silent. Always write the fresh state back to memory after comparing.\n- Wake notes arrive as plain prompts. A note reading probe means run the probe task.\n\nTasks you receive:\n- watch { name, url }: store endpoint:<name> (overwrite if it exists) and confirm in one line with the total number of watched endpoints.\n- probe {}: probe every watched endpoint, apply the transition rules, then call schedule with in set to 5 minutes and note set to probe. Answer with one line per endpoint formatted as <name>: <up or down> (<latency> ms), each line suffixed with NEW INCIDENT or RECOVERED when you alerted for it.";

// ── Custom capabilities ────────────────────────────────────────────────────
// STUB TOOLS: the sandbox has no network — point probe_endpoint at your
// HTTP checker service and send_alert at PagerDuty, Opsgenie, or Slack.
// Custom tools live in source only — never in the manifest.

const probeEndpoint = {
  name: "probe_endpoint",
  description: "Probe a URL and report whether it is healthy, with status code and latency.",
  params: {
    type: "object",
    properties: { url: { type: "string", description: "The health-check URL to probe" } },
    required: ["url"],
  },
  // STUB — wire this to your HTTP prober.
  async run({ url }) {
    return { url, ok: true, status: 200, latency_ms: 87 };
  },
};

const sendAlert = {
  name: "send_alert",
  description: "Page the on-call channel. severity is incident for a new outage, recovery for a return to service.",
  params: {
    type: "object",
    properties: {
      severity: { type: "string", description: "incident or recovery" },
      message: { type: "string", description: "One-line alert text naming the endpoint" },
    },
    required: ["severity", "message"],
  },
  // STUB — wire this to your paging provider.
  async run({ severity, message }) {
    return { paged: true, severity, message };
  },
};

const agent = new Agent("uptime-watchdog", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-haiku", // a 5-minute probe cycle must cost pennies
    budgets: { perDayCents: 150 },
  },
  // memory for endpoint configs and last-known states, schedule for the
  // self-booking probe cycle. Both stubs are the outside world.
  capabilities: [tools.memory, tools.schedule, probeEndpoint, sendAlert],
});

agent.task("watch", async (args) => {
  // Validate at the boundary — no tokens spent on a malformed endpoint.
  const name = typeof args.name === "string" ? args.name.trim() : "";
  const url = typeof args.url === "string" ? args.url.trim() : "";
  if (name.length === 0 || url.length === 0) {
    throw new Error("watch requires { name, url }");
  }
  const result = await agent.llm("Task: watch " + JSON.stringify({ name, url }), {
    maxSteps: 6,
    maxCost: 0.05,
  });
  return { reply: result.text, status: result.status, cost: result.cost };
});

/** One probe pass over every endpoint; the identity carries the transition rules. */
async function runProbe() {
  const result = await agent.llm("Task: probe {}", { maxSteps: 20, maxCost: 0.1 });
  return { status: result.status, cost: result.cost, report: result.text };
}

agent.task("probe", () => runProbe());

// Belt-and-braces trigger; the schedule capability keeps the cycle alive.
agent.schedule("probe-cycle", "every 5 m", runProbe, { maxCost: 0.1 });

// status — pure primitives, zero LLM cost: the remembered state of the fleet.
agent.task("status", async () => {
  const keys = await agent.memory.list("state:");
  const fleet = {};
  for (const key of keys) {
    fleet[key.slice("state:".length)] = await agent.memory.get(key);
  }
  return fleet;
});

export default agent;
