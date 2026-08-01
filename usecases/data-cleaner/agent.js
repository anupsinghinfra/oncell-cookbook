/**
 * data-cleaner — drop a messy CSV or JSON file on it and get back a
 * normalized version plus a report of every change it made. The cleaning
 * rules are a skill; the verification is real shell commands.
 *
 * Superpowers on display:
 *   - shell: wc, sort, uniq, awk against the actual file — row counts in
 *     the report are counted, not estimated.
 *   - skills: the canonical formats (dates, emails, empties, dedupe) are
 *     one versioned procedure.
 *   - files: raw input, cleaned output, and the change report all live on
 *     the durable filesystem, side by side.
 *
 * Deploy:  npm run deploy data-cleaner
 * Invoke:  curl -X POST https://api.oncell.ai/api/v1/agents/data-cleaner/clean \
 *            -H "Authorization: Bearer $ONCELL_API_KEY" \
 *            -H "Content-Type: application/json" \
 *            -d '{"filename": "leads.csv", "content": "email,signup date\nDANA@X.COM,01/02/2026\ndana@x.com,2026-01-02\n"}'
 */
import { Agent, tools, skill } from "oncell";

// Identity — one JSON-style literal so `npm run validate` can check
// manifest.json against this file byte-for-byte.
const IDENTITY_INSTRUCTIONS = "You are data-cleaner: files come in messy - inconsistent dates, mixed-case emails, duplicate rows, ragged whitespace - and leave normalized, with a report of exactly what changed. You never silently drop data you were not told to drop.\n\nState you own:\n- incoming/<filename> - the raw file exactly as received, never modified.\n- cleaned/<filename> - the normalized output.\n- cleaned/<filename>.report.md - what changed, with counts.\n\nHow you work:\n- Inspect before and after with shell, not by eyeballing: wc -l for row counts, sort piped to uniq -d to find exact duplicates, head to check structure. Every count in your report must come from a command you ran.\n- The cleaning-rules skill is the normalization procedure - activate it for every file and follow it exactly.\n\nTasks you receive:\n- clean { filename, content }: the handler already saved the raw file to incoming/<filename>. Inspect it, activate cleaning-rules, write the cleaned file and the report, and answer with one line: cleaned <filename>: N rows in, M rows out, D duplicates removed, C cells normalized.\n- report { filename }: return cleaned/<filename>.report.md verbatim, or say it does not exist.";

// ── The cleaning-rules skill ───────────────────────────────────────────────
// Canonical formats as a versioned procedure. While active, tools narrow
// to files + shell: read, verify, write - nothing else.
const cleaningRules = skill("cleaning-rules", {
  description: "Normalization rules for tabular data: canonical dates and emails, whitespace, empty markers, and exact-duplicate removal.",
  instructions: "Cleaning rules, applied in order:\n1. Trim leading and trailing whitespace in every cell; collapse internal runs of spaces to one.\n2. Dates in any recognizable format become YYYY-MM-DD. An ambiguous date like 03/04/05 is NOT normalized - flag it in the report instead of guessing.\n3. Emails are lowercased; an email without an at sign is flagged, not altered.\n4. Empty markers - NA, N/A, null, NULL, a lone dash - become truly empty cells.\n5. Exact-duplicate rows (identical after steps 1-4) are removed; first occurrence stays. Near-duplicates are flagged in the report, never removed.\n6. Header row is preserved; column order is never changed; no column is ever dropped.\nVerify with shell: wc -l on input and output, sort | uniq -d for duplicates before removal. Write cleaned/<filename>, then cleaned/<filename>.report.md with sections Counts (rows in, rows out, duplicates removed, cells normalized) and Flags (each unresolved oddity with its line number).",
  tools: [tools.files, tools.shell],
});

const agent = new Agent("data-cleaner", {
  identity: {
    instructions: IDENTITY_INSTRUCTIONS,
    model: "claude-sonnet",
    budgets: { perDayCents: 200 }, // $2/day cleans a steady stream of files
  },
  capabilities: [tools.files, tools.shell],
  skills: [cleaningRules],
});

agent.task("clean", async (args) => {
  // Validate at the boundary — no tokens spent on an empty upload.
  const filename = typeof args.filename === "string" ? args.filename.trim() : "";
  const content = typeof args.content === "string" ? args.content : "";
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    throw new Error("clean requires { filename } using only letters, digits, dots, dashes, underscores");
  }
  if (content.trim().length === 0) throw new Error("clean requires non-empty { content }");

  // Save the raw file BEFORE the loop — the shell inspection needs a real
  // file, and incoming/ keeps the untouched original forever.
  await agent.files.write("incoming/" + filename, content);

  const result = await agent.llm(
    "Task: clean " + JSON.stringify({ filename }) + " - the raw file is saved at incoming/" + filename + " (" + content.length + " bytes).",
    { maxSteps: 18, maxCost: 0.6 },
  );
  return { reply: result.text, status: result.status, cost: result.cost };
});

// report — pure primitives, zero LLM cost: fetch a past change report.
agent.task("report", async (args) => {
  const filename = typeof args.filename === "string" ? args.filename.trim() : "";
  if (filename.length === 0) throw new Error("report requires { filename }");
  const content = await agent.files.read("cleaned/" + filename + ".report.md");
  return content ?? "No report for " + filename + " - run clean first.";
});

export default agent;
