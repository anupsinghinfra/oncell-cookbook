# Video script — price-monitor (70s)

## Hook (0-8s)

**Screen:** A sales call transcript snippet: "...well, their plan is $10 cheaper now." Reaction beat. Cut to a terminal line: `ALERT Acme Pro plan: 49 -> 52.5 (+7.1%)`.
**VO:** "You should never learn a competitor's price change from a customer. This agent checks every day and only speaks when the number actually moves."

## The file (8-22s)

**Screen:** `usecases/price-monitor/agent.js`. Highlight `model: "claude-haiku"` and `budgets: { perDayCents: 100 }`, then the two table declarations in the identity, then the ALERT output format line.
**VO:** "Haiku, a dollar-a-day hard cap. Two SQLite tables it creates itself: what to watch, and every price it has ever seen. The alert format is strict — one greppable line per move."

## Deploy + track (22-36s)

**Screen:** `npm run deploy price-monitor`. Curl `track` for two competitor plans. Then `curl .../check -d '{}'` → `all quiet - 2 products checked`.
**VO:** "Deploy, point it at pricing pages, run the first check. First observation is never an alert — there's nothing to compare against yet. And tomorrow's check? Already booked, by the agent itself."

## Money shot — the flag and the receipts (36-60s)

**Screen:** Dashboard: scheduled wake `check · in 1 day`. Time-skip three days. A check returns `ALERT Acme Pro plan: 49 -> 44 (-10.2%)`. Then `curl .../history -d '{"name":"Acme Pro plan"}'` → the JSON price series, no LLM cost shown in the trace.
**VO:** "Day four: Acme cuts ten percent. One alert line — pipe it straight to Slack. And the receipts are a real SQLite table: the full price series, readable for zero tokens, accumulated while you weren't looking."

## CTA (60-70s)

**Screen:** README catalog, price-monitor row.
**VO:** "price-monitor, from oncell-cookbook. Swap the stub fetcher for your scraper, deploy in one command, and stop being surprised on sales calls. Link below."
