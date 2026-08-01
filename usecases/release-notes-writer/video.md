# Video script — release-notes-writer (70s)

## Hook (0-8s)

**Screen:** A changelog page showing: "fix: race in token refresh (again) — JIRA-4821". Slow zoom on "(again)".
**VO:** "Somebody shipped their commit log to customers. Again. Release notes are a translation job — and this agent does it with evidence."

## The file (8-24s)

**Screen:** `usecases/release-notes-writer/agent.js`. Highlight the identity's survey rule ("wc -l... grep -c on feat:, fix:..."), then the `house-style` skill — pausing on "Fixes are reassurance, not confession" and the hide-list.
**VO:** "Two halves. Accounting: it greps the saved log in a sandbox — counts features, counts fixes — before writing a word. Storytelling: a house-style skill — benefit-first bullets, no ticket ids, no root-cause confessions, chores invisible."

## Deploy + write (24-44s)

**Screen:** `npm run deploy release-notes-writer`. Then the git-log-to-curl pipe. The trace shows: `shell: wc -l worklog/commits.txt` → 38, `shell: grep -c '^feat' ...` → 5. Then the finished notes render: one summary line, New, Improved, Fixed.
**VO:** "Pipe git log straight in. Watch the trace: thirty-eight commits, five features, counted before claimed. The notes say five new things because the log contains five — not because five sounded right."

## Money shot — the transformation (44-62s)

**Screen:** Split view. Left: `feat: add bulk CSV export`, `fix: crash on empty search`, `chore: bump deps`. Right: "Export your entire workspace to CSV in one click." / "Searching with an empty box no longer crashes the app." / — nothing.
**VO:** "Feature becomes benefit. Fix becomes reassurance. And the dependency bump? Customers can't perceive it, so it doesn't exist. That judgment is a versioned skill — marketing edits a file, redeploys, and every future release speaks the new voice."

## CTA (62-70s)

**Screen:** README catalog, release-notes-writer row; `release-notes/` directory listing growing.
**VO:** "release-notes-writer, from oncell-cookbook. Wire it to your release pipeline and the announcement drafts itself. Link below."
