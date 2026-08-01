---
title: The Watchdog that Never Pages Twice for the Same Outage
description: An uptime monitor built on durable memory and self-booked probes — it alerts on state changes, not states, and its scheduler cannot go down with your host.
date: 2026-08-01
slug: uptime-watchdog
---

# The Watchdog that Never Pages Twice for the Same Outage

There are two ways a homegrown uptime checker ruins your week. The loud way: the API goes down at 2am and the checker faithfully fires an alert every five minutes until dawn — sixty pages for one incident, and by page eleven the on-call has muted the channel that was supposed to save them. The quiet way is worse: the checker itself lived on the same box as everything else, so when the box died, the thing whose only job was to notice... didn't.

Both failures have the same root: a monitor needs *memory* (is this outage news, or the same outage?) and *independent time* (a heartbeat that doesn't share fate with what it watches). Most homegrown checkers have neither — they're a stateless loop in a process you also have to monitor. Monitoring your monitoring is the punchline of an infrastructure joke everyone has lived.

`uptime-watchdog` gets both properties from the runtime, in one file.

## Transitions, not states

The core rule is three sentences of identity in [`agent.js`](agent.js):

> "Alert only on transitions: probe result down while remembered state is up or missing means send an incident alert; probe result up while remembered state is down means send a recovery alert; any result matching the remembered state means stay silent."

The "remembered state" is durable KV — one `state:<name>` key per endpoint, read before judging and written after. Because it's runtime memory rather than process memory, a redeploy mid-outage doesn't reset it: the watchdog wakes up post-deploy still knowing the API is down, and stays correctly silent instead of re-paging. That single property — incident state that survives restarts — is what separates "monitor" from "noise generator," and here it costs one capability declaration:

```js
capabilities: [tools.memory, tools.schedule, probeEndpoint, sendAlert],
```

`probe_endpoint` and `send_alert` are the two stubs: the sandbox has no network, so you point one at your HTTP checker and the other at PagerDuty or Slack. The manifest carries only `memory` and `schedule`.

## A heartbeat with no host

Every probe pass ends by booking the next one — "call schedule with in set to 5 minutes and note set to probe" — a durable wake intent in the runtime's park ledger. Between probes, the watchdog doesn't exist as a process at all. There is no watchdog box to go down, no PM2 to restart, no shared fate with the infrastructure it watches. The runtime owns the heartbeat; the agent just describes it. A belt-and-braces cron registration (`agent.schedule("probe-cycle", "every 5 m", ...)`) starts the cycle even before the first self-booked wake exists.

And because a probe cycle runs ~288 times a day, the economics are engineered down hard: `claude-haiku`, each pass capped at `{ maxSteps: 20, maxCost: 0.1 }`, the whole agent ceilinged at `perDayCents: 150`. A silent, healthy day costs pennies.

## The fleet at zero tokens

```js
agent.task("status", async () => {
  const keys = await agent.memory.list("state:");
  ...
});
```

`status` never touches the model — it lists the `state:` keys and returns the remembered fleet state directly. Dashboards can poll it for free.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy uptime-watchdog
```

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/uptime-watchdog/watch \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "api", "url": "https://api.myapp.example/health"}'

curl -X POST https://api.oncell.ai/api/v1/agents/uptime-watchdog/probe -d '{}'
```

The first probe reports `api: up (87 ms)` and books the next pass. When the endpoint fails, exactly one line grows a suffix — `api: down (0 ms) NEW INCIDENT` — one page goes out, and then silence until `RECOVERED`. The `status` task tells you what the watchdog currently believes, any time, for nothing.

## What you didn't have to build

A monitor host, and monitoring for the monitor host. A state store for incident dedup. Flap-suppression glue. A scheduler that survives deploys. Cost control for a loop that runs 288 times a day — the runtime enforces the per-pass cap and the daily ceiling.

You wrote the transition table in English and pointed two stubs at your prober and your pager. The runtime is the part that never sleeps.
