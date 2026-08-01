# Video script — uptime-watchdog (75s)

## Hook (0-10s)

**Screen:** A phone lock screen filling with identical PagerDuty alerts: "api DOWN" ×14, timestamps 5 minutes apart. Then one clean pair of messages: "NEW INCIDENT: api down" ... "RECOVERED: api up".
**VO:** "Your uptime checker paged fourteen times for one outage — because it can't remember the last five minutes. This one remembers everything."

## The file (10-25s)

**Screen:** `usecases/uptime-watchdog/agent.js`. Highlight the transition rules in the identity ("Alert only on transitions..."), then `capabilities: [tools.memory, tools.schedule, probeEndpoint, sendAlert]`, then `model: "claude-haiku"`.
**VO:** "The whole alerting policy is three sentences: down is news once, up again is news once, everything else is silence. Last-known state lives in durable memory. Haiku runs the cycle for pennies."

## Deploy + watch (25-38s)

**Screen:** `npm run deploy uptime-watchdog`, then `curl .../watch` for `api` and `web`, then `curl .../probe -d '{}'` → `api: up (87 ms)` / `web: up (110 ms)`. Dashboard shows scheduled wake `probe · in 5 minutes`.
**VO:** "Deploy, register endpoints, probe once. From here it books its own next pass every five minutes — there is no watchdog box, so there's no watchdog box to go down."

## Money shot — the redeploy mid-outage (38-65s)

**Screen:** Probe returns `api: down (0 ms) NEW INCIDENT` — one page fires. Next probe: `api: down` — trace shows memory read `state:api = down`, no alert sent. Then: `npm run deploy uptime-watchdog` (v2) mid-outage. Next probe after the deploy: still silent. Finally `api: up (92 ms) RECOVERED`.
**VO:** "Incident: one page. Five minutes later: still down, still silent — it remembers. Now the cruel test: redeploy the agent in the middle of the outage. The state survives, so it *stays* silent. One recovery page when it's over. Two pages, total, for the whole incident."

## CTA (65-75s)

**Screen:** README catalog, uptime-watchdog row.
**VO:** "uptime-watchdog, from oncell-cookbook. Point the stubs at your prober and your pager, deploy in one command, unmute the channel. Link below."
