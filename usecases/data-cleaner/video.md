# Video script — data-cleaner (75s)

## Hook (0-8s)

**Screen:** A file explorer: `leads_FINAL.csv`, `leads_FINAL_dedeuped.csv`, `leads_FINAL_v2_USE_THIS.csv`. Slow zoom on the typo in "dedeuped".
**VO:** "Every ops team has this folder. The problem was never fixing the data — it's proving what changed. This cleaner keeps receipts."

## The file (8-24s)

**Screen:** `usecases/data-cleaner/agent.js`. Highlight cleaning rule 2 ("An ambiguous date like 03/04/05 is NOT normalized - flag it... instead of guessing"), rule 6 ("no column is ever dropped"), then the identity line "Every count in your report must come from a command you ran."
**VO:** "Six rules in a versioned skill — including two refusals: never guess an ambiguous date, never drop a column. And every number in the report must come from a shell command, not a vibe."

## Deploy + clean (24-44s)

**Screen:** `npm run deploy data-cleaner`. Curl `clean` with a visibly messy CSV — `DANA@X.COM`, `01/02/2026`, trailing spaces, `N/A`. Trace scrolls: `shell: wc -l incoming/leads.csv` → 4, `shell: sort ... | uniq -d` → 1 line. Response: `cleaned leads.csv: 3 rows in, 2 rows out, 1 duplicates removed, 4 cells normalized`.
**VO:** "One curl. Watch the trace: it counts rows, finds duplicates with sort and uniq — in a gVisor sandbox — then writes the cleaned file and a report where every count was actually counted."

## Money shot — the dedupe scripts miss (44-64s)

**Screen:** Split view. Input rows: `DANA@X.COM, 01/02/2026` and `dana@x.com␣␣, 2026-01-02` — visually different. After rules 1-4 both render identically; one gets removed. The report's Flags section shows: `line 7: ambiguous date 03/04/05 - not normalized`.
**VO:** "These two rows are the same lead — but only *after* normalization. Scripts dedupe raw and miss it; this cleans first, then dedupes. And the date it couldn't be sure about? Flagged with a line number. Never guessed."

## CTA (64-75s)

**Screen:** README catalog, data-cleaner row; the three artifacts side by side: `incoming/`, `cleaned/`, `report.md`.
**VO:** "data-cleaner, from oncell-cookbook. Original preserved, output normalized, report counted. Clone it and delete the FINAL_v2 folder. Link below."
