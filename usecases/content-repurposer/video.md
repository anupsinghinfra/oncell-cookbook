# Video script — content-repurposer (70s)

## Hook (0-8s)

**Screen:** A tweet draft: "🧵 1/ Game-changing insights about microservices! #DevOps #Engineering" — big red X. Then a clean one: "We deleted 40% of our tests during a build migration. On purpose."
**VO:** "Paste your post into a chatbot and it comes back sounding like everyone. This agent has your voice checked into a file."

## The file (8-24s)

**Screen:** `usecases/content-repurposer/agent.js`. Scroll the `voice-rules` skill: "No hashtags, no emoji, no hype adjectives", the per-channel blocks, then `tools: [tools.files]`.
**VO:** "The house voice is a skill: one diffable block with rules per channel — thread, LinkedIn, newsletter. Change the brand voice? Edit the skill, redeploy, and every future derivative shifts together. While it's active, the agent can touch files and nothing else."

## Deploy + repurpose (24-42s)

**Screen:** `npm run deploy content-repurposer`. Curl `repurpose` with a real post. Response shows three paths — `repurposed/why-we-killed-our-microservices/thread.md`, `linkedin.md`, `newsletter.md` — and three first lines.
**VO:** "Deploy, send one post. Back come three channel-native pieces — each opening with the most surprising detail in the post, because that's what the rules say. Every claim traceable to the source: derive, never invent."

## Money shot — the library (42-60s)

**Screen:** `curl .../list -d '{}'` → a growing tree of slugs and files across weeks of posts. Open one from a month ago; the file is there, intact. Trace shows the list call cost: no LLM step.
**VO:** "And it's not a clipboard — it's a library. Every derivative ever produced, archived on the agent's durable filesystem, synced to S3 by the runtime. Listing it costs zero tokens."

## CTA (60-70s)

**Screen:** README catalog, content-repurposer row.
**VO:** "content-repurposer, from oncell-cookbook. Put your voice in the skill, wire it to your CMS webhook, and the derivatives just exist. Link below."
