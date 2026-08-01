# Video script — support-agent (75s)

## Hook (0-8s)

**Screen:** Split screen. Left: a chat where a bot says "Hi! How can I help you today?" to "Sarah — 14 previous orders". Right: the same message with the reply "Welcome back Sarah — is this about the linen overshirt exchange?"
**VO:** "Every support bot forgets your customers. And the ones that don't... will refund anything if you ask twice. Here's the fix, in one file."

## The file (8-22s)

**Screen:** `usecases/support-agent/agent.js` scrolled slowly. Highlight three regions in sequence: `identity` (with `budgets: { perDayCents: 500 }`), `capabilities`, the `refunds` skill.
**VO:** "One agent, three declarations. Who it is — including a five-dollar-a-day spend ceiling the runtime enforces. What it can touch. And a refunds skill: the procedure, plus the only tools allowed while money is on the table."

## Deploy (22-32s)

**Screen:** Terminal. `npm run deploy support-agent` → `deployed  support-agent  v1  https://api.oncell.ai/api/v1/agents/support-agent`.
**VO:** "One command. It's live behind an API."

## Money shot 1 — memory (32-48s)

**Screen:** Two curls to `/chat`. First: "My name is Sarah, I ordered the linen overshirt." Second, a beat later: "What did I order again?" — the reply names the overshirt.
**VO:** "Per-customer memory is one line: `memory.forUser`. Every customer gets their own shelf — durable across conversations, restarts, and deploys."

## Money shot 2 — the park (48-68s)

**Screen:** Curl: "I want a refund for AC-1042." Cut to the OnCell dashboard: a parked run with the question "Refund $89 for order AC-1042 - item returned within window. Approve?" Click Approve. The curl response completes: "Your refund is on its way — 5 to 7 business days."
**VO:** "Refunds hit `ask_human`. The run parks — zero compute — until a person approves. Crash the host, redeploy the agent: it still resumes exactly where it stopped. Nobody sweet-talks this bot out of money."

## CTA (68-75s)

**Screen:** README of oncell-cookbook, catalog table visible.
**VO:** "That's `support-agent` from oncell-cookbook. Clone it, add your key, deploy in one command. Link below."
