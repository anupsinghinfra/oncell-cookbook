# Video script — lead-qualifier (75s)

## Hook (0-8s)

**Screen:** A CRM inbox: 31 new leads. Zoom on three: "Student — class project", "VP Ops — 800 vehicles — API pricing", "Founder — 12-person fleet — demo?".
**VO:** "Two of these leads don't need a human. One of them really does. The trick is knowing which is which — automatically."

## The file (8-24s)

**Screen:** `usecases/lead-qualifier/agent.js`. Highlight the `icp-rubric` skill — point values visible — then the verdict bands "70 to 100: QUALIFIED... 41 to 69: borderline - call ask_human", then `tools: [tools.db, tools.ask_human]`.
**VO:** "The ICP is a skill: point values for company fit, buyer fit, intent. Versioned, diffable — change your ICP by editing a file. Two bands decide instantly. The middle band must ask a human. That's the whole architecture."

## Deploy + the obvious cases (24-40s)

**Screen:** `npm run deploy lead-qualifier`. Curl the student → `DISQUALIFIED - 5 - no company, no budget, research project`. Curl the VP → `QUALIFIED - 85 - director-plus title, large fleet, pricing intent`.
**VO:** "Deploy. The obvious miss and the obvious fit come back in seconds, one parseable line each, every verdict recorded in SQLite."

## Money shot — the borderline park (40-65s)

**Screen:** Curl the 12-person fleet founder — the request hangs. Dashboard: parked run, question "55: strong intent but tiny fleet. Qualify?", status **parked · $0/hr**. A salesperson clicks Approve: "founder-led, growing fast". The response completes: `QUALIFIED - 55 - founder-led, growing fast`.
**VO:** "The maybe? It parks. Zero compute, one crisp question in the dashboard. Sales answers between meetings, the run resumes mid-procedure, and the human reason lands in the verdict *and* the audit trail. Your team only ever sees the leads where judgment matters."

## CTA (65-75s)

**Screen:** README catalog, lead-qualifier row.
**VO:** "lead-qualifier, from oncell-cookbook. Rewrite the rubric to your ICP, deploy in one command, and give your AEs their mornings back. Link below."
