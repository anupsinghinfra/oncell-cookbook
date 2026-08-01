# Video script — data-retention-janitor (70s)

## Hook (0-10s)

**Screen:** A disk-usage graph climbing toward a red line. A Slack thread: "what's safe to delete from the events table?" — "no idea, ask Marcus" — "Marcus left in March."
**VO:** "Durable state is the point of an agent runtime. It's also a landfill with a growth rate — unless something is scheduled to take out the trash."

## The file (10-25s)

**Screen:** `usecases/data-retention-janitor/agent.js`. Highlight "Missing rules mean nothing is purged - you never guess a retention policy", then the sweep procedure, then `model: "claude-haiku"`, `perDayCents: 40`.
**VO:** "The self-maintenance cadence: the agent is its own operand. A weekly wake applies declared rules to its own database and files. No rules declared? Nothing deleted — a janitor that improvises is an incident."

## Deploy + policy (25-38s)

**Screen:** `npm run deploy data-retention-janitor`, then `curl .../set-rules -d '{"events_days":30,"reports_keep":12}'` — instant, zero tokens. A firehose of `log-event` calls scrolls. Then `curl .../start -d '{}'`.
**VO:** "Policy is one free memory write — changing it never means redeploying. Events pour in as free inserts. Start arms the Sunday sweep."

## Money shot — the receipts (38-62s)

**Screen:** Sunday: sweep fires. `reports/2026-08-09.md` opens: "Deleted 31,204 events rows older than 2026-07-10. Deleted reports/2026-05-17.md. Remaining: 42,118 rows, 12 reports. Rules: 30 days / keep 12." Then `curl .../set-rules` tightens to 14 days — next Sunday's report shows the bigger purge, no redeploy anywhere.
**VO:** "Every sweep publishes receipts: exact counts, the cutoff used, files by name. Tighten the policy with one call — next Sunday enforces it. And notice: the sweep reports themselves are on the retention schedule they enforce."

## CTA (62-70s)

**Screen:** README catalog, data-retention-janitor row.
**VO:** "data-retention-janitor, from oncell-cookbook. Declare two numbers, start it once, and answer the compliance question with a file instead of a shrug. Link below."
