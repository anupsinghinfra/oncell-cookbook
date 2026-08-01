# Video script — seo-brief-writer (75s)

## Hook (0-8s)

**Screen:** A Slack message: "can you just cover the basics of warehouse slotting? no time for a full brief". Cut to a rendered brief: Target, 3 titles, outline with a red **GAP** marker, entities, FAQs.
**VO:** "Content doesn't fail in the writing. It fails in the brief that never got written. This agent writes the full brief — every time, in one structure."

## The file (8-24s)

**Screen:** `usecases/seo-brief-writer/agent.js`. Scroll the `brief-format` skill — six numbered sections — pausing on "plus at least one angle none of them cover - mark it GAP". Then the identity line "serp_lookup is your only source of search-landscape data... Never invent rankings or search volumes."
**VO:** "The editorial standard is a skill: six sections, in order, including a mandatory gap no competitor covers. And the grounding rule is a contract — one SERP lookup per brief, every competitive claim traceable to it. No invented search volumes."

## Deploy + brief (24-42s)

**Screen:** `npm run deploy seo-brief-writer`. Curl `brief` with the keyword. Response: `briefs/warehouse-slotting-optimization.md`, best title, H2 list. Open the file: all six sections, FAQs with draft answers.
**VO:** "Deploy, send a keyword. Ninety strategist-minutes come back in about sixty seconds — outline, entities, people-also-ask questions with draft answers, writer notes with a word-count target."

## Money shot — the library compounds (42-65s)

**Screen:** Loop five keywords through. `curl .../library -d '{}'` → five brief paths. Open the newest brief's section 6: internal-link suggestions pointing at three of the earlier briefs.
**VO:** "Here's the compounding part: briefs live in a durable library, and every new brief suggests internal links to the ones already there. Brief twenty knows about briefs one through nineteen. Your content plan interlinks itself."

## CTA (65-75s)

**Screen:** README catalog, seo-brief-writer row.
**VO:** "seo-brief-writer, from oncell-cookbook. Point the stub at your SERP provider, encode your standard in the skill, and un-bottleneck the calendar. Link below."
