/**
 * seo-brief-writer — a keyword goes in, a complete content brief comes out:
 * outline, entities to cover, FAQs, and internal-link suggestions, archived
 * to a durable brief library.
 *
 * Superpowers on display:
 *   - skills: the brief format is a versioned editorial standard, loaded
 *     only when brief work starts.
 *   - files: every brief lands in briefs/ — writers pull from a library,
 *     not a Slack scrollback.
 *   - custom-tool stub: serp_lookup stands in for your SERP data provider;
 *     the sandbox itself has no network.
 *
 * Deploy:  npm run deploy seo-brief-writer
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/seo-brief-writer/brief \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"keyword": "warehouse slotting optimization"}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are seo-brief-writer: you turn a target keyword into a content brief a writer can execute without a single follow-up question.\n\nState you own:\n- Files under briefs/, one per keyword, named briefs/<keyword-slug>.md where <keyword-slug> is the keyword lowercased with spaces collapsed to hyphens.\n\nHow you work:\n- serp_lookup is your only source of search-landscape data; call it exactly once per brief and ground every competitive claim in what it returns. Never invent rankings or search volumes.\n- The brief-format skill is the editorial standard - activate it for every brief and follow its structure exactly.\n- If a brief for the keyword already exists, overwrite it and say you refreshed it.\n\nTasks you receive:\n- brief { keyword }: activate brief-format, call serp_lookup, write briefs/<keyword-slug>.md, and answer with the file path, the recommended title, and the H2 list - nothing else.\n- library {}: return the sorted list of paths under briefs/, no commentary.";

// ── Custom capability ──────────────────────────────────────────────────────
// STUB TOOL: replace `run` with your SERP data provider (DataForSEO,
// SerpAPI, an internal crawl). The sandbox has no network of its own.
// Custom tools live in source only — never in the manifest.
const serpLookup = {
  name: "serp_lookup",
  description: "Fetch the current top-10 results for a keyword: titles, H2 headings, and people-also-ask questions.",
  params: {
    type: "object",
    properties: { keyword: { type: "string", description: "The search query to look up" } },
    required: ["keyword"],
  },
  // STUB — wire this to your SERP API.
  async run({ keyword }) {
    return {
      keyword,
      results: [
        { rank: 1, title: keyword + " - the complete guide", headings: ["What is " + keyword, "Benefits", "Implementation steps"] },
        { rank: 2, title: "How to get started with " + keyword, headings: ["Common mistakes", "Tools", "Case study"] },
      ],
      people_also_ask: ["What is " + keyword + "?", "How much does " + keyword + " cost?"],
    };
  },
};

// ── The brief-format skill ─────────────────────────────────────────────────
// Your editorial standard as a versioned procedure. While active, tools
// narrow to serp_lookup + files: research and write, nothing else.
const briefFormat = skill("brief-format", {
  description: "The house structure for a content brief: title options, outline, entities, FAQs, and internal links, grounded in SERP data.",
  instructions: "Brief structure - every section, in this order:\n1. Target: the keyword, inferred search intent (informational, commercial, or transactional), and the reader in one line each.\n2. Title options: 3, under 60 characters, none starting with the keyword verbatim.\n3. Outline: H2s and nested H3s that cover every heading theme the top results share, plus at least one angle none of them cover - mark it GAP.\n4. Entities: 10 to 20 terms and concepts the article must mention to be credible.\n5. FAQs: every people-also-ask question from the SERP data, each with a 2-sentence draft answer.\n6. Notes for the writer: word-count target based on the competition, tone, and 3 internal-link suggestions as briefs/<slug> references to other briefs in the library when any exist.\nWrite the finished brief to briefs/<keyword-slug>.md, then answer with the path, the best title, and the H2 list.",
  tools: [serpLookup, tools.files],
});

const agent = new Agent("seo-brief-writer", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 300 }, // $3/day is a full content calendar of briefs
  },
  capabilities: [tools.files, serpLookup],
  skills: [briefFormat],
});

agent.task("brief", async (args) => {
  // Validate at the boundary — no tokens spent on an empty keyword.
  const keyword = typeof args.keyword === "string" ? args.keyword.trim() : "";
  if (keyword.length === 0 || keyword.length > 120) {
    throw new Error("brief requires { keyword } (1-120 characters)");
  }

  const result = await agent.llm("Task: brief " + JSON.stringify({ keyword }), {
    maxSteps: 12,
    maxCost: 0.6,
  });
  return { reply: result.text, status: result.status, cost: result.cost };
});

// library — pure primitives, zero LLM cost: the brief index.
agent.task("library", async () => {
  const names = await agent.files.list("briefs");
  return Array.isArray(names) ? names.sort() : [];
});

export default agent;
