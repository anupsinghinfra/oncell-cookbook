# Video script — inbox-triager (70s)

## Hook (0-8s)

**Screen:** An inbox with 214 unread. Then one terminal line returning: `urgent | p0 | Reply with payment confirmation`.
**VO:** "Every email, labeled and prioritized with a suggested action — for a fraction of a cent. And unlike your last classifier, this one remembers who's writing."

## The file (8-24s)

**Screen:** `usecases/inbox-triager/agent.js`. Highlight `model: "claude-haiku"` and `budgets: { perDayCents: 100 }`, then the `triage-rules` skill block, then `rollup`.
**VO:** "Haiku, one dollar a day, hard-capped by the runtime. The rules aren't a prompt blob — they're a skill. Versioned, diffable, loaded only when triage starts. A second skill turns the same memory into a weekly report."

## Deploy + triage (24-42s)

**Screen:** `npm run deploy inbox-triager`. Curl a newsletter → `notification | p2 | Archive`. Curl an overdue invoice → `urgent | p0 | Reply with payment confirmation or dispute`.
**VO:** "Deploy, then feed it anything. Strict one-line output — the pipe-separated format your automation can parse with a split."

## Money shot — sender memory (42-60s)

**Screen:** Curl the SAME suspicious message twice, from two senders: `from: unknown@newdomain.example` asking for a wire transfer → `spam | p2 | Block sender`. Then `from: cfo@ourco.example` (previously triaged 30 times, show `sender:cfo@ourco.example:seen = 30` in a memory list) → `urgent | p0 | Call the CFO to confirm the transfer`.
**VO:** "Same words, different senders, different answers. The agent keeps durable memory of every sender it's ever seen — a first-timer asking for money is spam; your CFO is an emergency. That history survives restarts, redeploys, everything."

## CTA (60-70s)

**Screen:** README catalog, inbox-triager row.
**VO:** "inbox-triager, from oncell-cookbook. Clone it, point your mail webhook at it, done. Link below."
