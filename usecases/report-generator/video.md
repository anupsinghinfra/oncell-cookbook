# Video script — report-generator (70s)

## Hook (0-8s)

**Screen:** A Slack channel: "weekly metrics" — last message 11 weeks ago: "will send Monday!". Cut to a fresh markdown report: Summary, Movers, Full table.
**VO:** "The weekly report died the week its owner went on vacation. This one has no owner."

## The file (8-24s)

**Screen:** `usecases/report-generator/agent.js`. Highlight the `record` handler — visibly no `agent.llm` call — then the identity's three-section format, then `capabilities: [tools.db, tools.files, tools.schedule]`.
**VO:** "Two halves. Ingestion: a task with no model in it — validate, insert into SQLite, done, zero tokens, fire it from anywhere. Judgment: one LLM pass a week with a fixed format — summary, movers over ten percent, full table."

## Deploy + instrument (24-38s)

**Screen:** `npm run deploy report-generator`. Three quick curls: `{"metric":"signups","value":42}`, `{"metric":"mrr","value":18200}`, `{"metric":"churn","value":3}` — each returning instantly, traces showing no LLM steps.
**VO:** "Deploy, then point your cron jobs and CI at record. A week of ingestion costs exactly nothing."

## Money shot — Monday happens (38-62s)

**Screen:** `curl .../report -d '{}'` → the compiled report scrolls: "Movers: signups: 217 -> 261 (+20.3%)". Dashboard shows the new wake intent `report · in 7 days`. Then `curl .../latest -d '{}'` returning the same file, trace: zero LLM cost.
**VO:** "Monday: one judgment pass reads the table, writes the report to durable files, and books next Monday itself — the cadence lives in the runtime, not in someone's calendar. Fetching the latest report? Free, forever."

## CTA (62-70s)

**Screen:** README catalog, report-generator row.
**VO:** "report-generator, from oncell-cookbook. A table schema and a format — the runtime does Mondays now. Link below."
