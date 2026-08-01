# Video script — standup-collector (75s)

## Hook (0-8s)

**Screen:** A standup thread with 3 of 6 replies, timestamps scattered across the day. Hard cut to one clean post: Done / Doing / Blocked / "No reply: sam".
**VO:** "Standups don't die because people hate writing them. They die because nobody wants to chase. So this agent chases."

## The file (8-24s)

**Screen:** `usecases/standup-collector/agent.js`. Highlight `capabilities: [tools.memory, tools.schedule, tools.agents, sendMessage]`, then the identity line "call schedule twice: once with in set to 2 hours and note set to compile, once with in set to 1 day and note set to collect".
**VO:** "Four capabilities. Memory for the roster and today's replies. Schedule — every collection books its own compile in two hours and its own tomorrow. And agents: it can call other deployed agents directly."

## Deploy + collect (24-40s)

**Screen:** `npm run deploy standup-collector`. Then `curl .../add-member -d '{"name":"dana","handle":"@dana"}'`, then `curl .../collect -d '{}'` → "6 pings sent, compiling in 2 hours."
**VO:** "Deploy, add the team, kick it off once. From here it runs itself — the wake intents live in the runtime, not in a cron box you have to babysit."

## Money shot — the compile and the handoff (40-65s)

**Screen:** Dashboard showing two scheduled wakes: `compile · in 2h`, `collect · in 1d`. Time-skip. The compiled standup posts to `team-standup` — bullets tagged by name, last line "No reply: sam". Then the trace: `agents_invoke → daily-digest.add-note`.
**VO:** "Two hours later it compiles: done, doing, blocked, and — the part humans skip — who never answered. Then watch the trace: it files a one-line summary with the daily-digest agent. Two agents you deployed separately, composing with one tool call."

## CTA (65-75s)

**Screen:** README catalog, standup-collector row highlighted.
**VO:** "standup-collector, from oncell-cookbook. One file, two dollars a day, zero chasing. Link below."
