---
title: Clean the CSV, Keep the Receipts
description: A data-cleaning agent whose normalization rules are a versioned skill, whose counts come from real shell commands, and whose changes are always reported, never silent.
date: 2026-08-01
slug: data-cleaner
---

# Clean the CSV, Keep the Receipts

Every operations team has a folder of shame: `leads_FINAL.csv`, `leads_FINAL_deduped.csv`, `leads_FINAL_deduped_v2_use_this_one.csv`. Somewhere between the export and the import, a human spent ninety minutes fixing dates that were `01/02/2026` in some rows and `2026-01-02` in others, lowercasing emails, hunting duplicates by eye — and nobody can say afterwards *what exactly changed*, which means nobody fully trusts the file, which is how you end up with a v3.

The two classic automations both disappoint. A hand-rolled script handles the messes its author has personally seen, then silently mangles the first `03/04/05` it meets — is that March 4th or April 3rd? And pasting the file into a chat window gets you back a "cleaned" version with no guarantee the row count is even the same, because nothing counted.

`data-cleaner` splits the job the way a careful data engineer would: judgment where judgment belongs, and *counting by command* everywhere else.

## Rules with a refusal built in

The normalization procedure is a skill in [`agent.js`](agent.js), and its most important rules are the ones that refuse:

> "2. Dates in any recognizable format become YYYY-MM-DD. An ambiguous date like 03/04/05 is NOT normalized - flag it in the report instead of guessing.
> ...
> 5. Exact-duplicate rows (identical after steps 1-4) are removed; first occurrence stays. Near-duplicates are flagged in the report, never removed."

Guessing is the cardinal sin of data cleaning, so ambiguity becomes a flag with a line number, not a coin flip. Rule 6 completes the safety net — header preserved, column order untouched, no column ever dropped — and the identity states the covenant plainly: "You never silently drop data you were not told to drop." When your ops team decides `-` should mean empty too, they edit the skill and redeploy; the rules are a diffable artifact, not tribal knowledge in someone's Python script.

## Counts come from commands

The handler saves the raw file to the durable filesystem *before* the model runs:

```js
await agent.files.write("incoming/" + filename, content);
```

Then the identity forbids eyeballed arithmetic:

> "Inspect before and after with shell, not by eyeballing: wc -l for row counts, sort piped to uniq -d to find exact duplicates... Every count in your report must come from a command you ran."

Those commands execute in the gVisor sandbox and appear in the run trace, so when the report says "3 duplicates removed," there's a `sort | uniq -d` in the log that found exactly 3. Three artifacts come out of every run, side by side: `incoming/<filename>` (untouched original, forever), `cleaned/<filename>`, and `cleaned/<filename>.report.md` with its Counts and Flags sections. The `report` task fetches any past report for zero tokens.

Also note the one security-flavored line in the handler — `/^[a-zA-Z0-9._-]+$/.test(filename)` — because a filename is a path, and paths from the outside world get validated before they touch a filesystem, agent or not.

## Deploy it

```bash
git clone https://github.com/oncell/oncell-cookbook && cd oncell-cookbook
cp .env.example .env   # add your ONCELL_API_KEY
npm run deploy data-cleaner
```

```bash
curl -X POST https://api.oncell.ai/api/v1/agents/data-cleaner/clean \
  -H "Authorization: Bearer $ONCELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"filename": "leads.csv", "content": "email,signup date\nDANA@X.COM,01/02/2026\ndana@x.com  ,2026-01-02\nsam@y.com,N/A\n"}'
```

Back comes the one-line summary — `cleaned leads.csv: 3 rows in, 2 rows out, 1 duplicates removed, 4 cells normalized` — with the full story in the report: the uppercase email lowercased, the trailing spaces trimmed, the `N/A` emptied, and the row that became identical after normalization, removed with its line number cited. That last one is the case scripts miss: `DANA@X.COM, 01/02/2026` and `dana@x.com  , 2026-01-02` are the same row, but only *after* cleaning — dedupe has to run on normalized data, and rule 5 sequences exactly that.

## What you didn't have to build

A zoo of format-fixing scripts, one per surprise. A sandbox where untrusted file content can be safely processed with real tools. An audit trail of changes — the report and the preserved original *are* the audit trail. A guessing policy — the skill encodes when to refuse.

You wrote six rules and their order. The agent counts its way through every file, and for once, the "cleaned" in the filename is a claim with receipts.
