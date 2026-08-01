# Video script — backup-auditor (75s)

## Hook (0-10s)

**Screen:** A backup dashboard, 400 green checkmarks. Zoom into one. It's a 4 KB file. Terminal: `pg_restore: error: input file appears to be empty`.
**VO:** "Four hundred green checkmarks. Zero restores. You don't have backups — you have a rumor."

## The file (10-25s)

**Screen:** `usecases/backup-auditor/agent.js`. Highlight the failure rule in the identity, then the drill procedure ("call ask_human ... restore its latest backup"), then `model: "claude-haiku"`.
**VO:** "Two chains in one agent: a daily verify — mechanical, haiku, pennies — and a monthly drill that refuses to be automated. It makes a human restore something."

## Deploy + arm (25-38s)

**Screen:** `npm run deploy backup-auditor`, `curl .../add-job` ×3 (instant, zero tokens), `curl .../start -d '{}'`. Dashboard: `verify · in 1 day`, `drill · in 30 days`.
**VO:** "Register the fleet — free SQLite inserts. One start call arms both clocks: the fast loop and the slow one."

## Money shot — the park (38-65s)

**Screen:** Day 30: drill wake fires. Run status flips to `parked — asking human`: "Restore prod-postgres-nightly's latest backup to a scratch env and reply with what you found." Cost meter: $0.00 while parked, 3 days pass on the timeline — and verify wakes keep firing daily underneath. Human replies "restored clean, 812 MB, checksums match." Run resumes, `drill_result` lands in the table, `drill · in 30 days` re-books.
**VO:** "The drill parks on a person — three days at zero dollars, while the daily checks keep running underneath, unblocked. The human answers, the run wakes up, the result goes on permanent record, next month books itself."

## CTA (65-75s)

**Screen:** README catalog, backup-auditor row.
**VO:** "backup-auditor, from oncell-cookbook. Wire check_backup to your backup system and let it make your team the first kind of team. Link below."
