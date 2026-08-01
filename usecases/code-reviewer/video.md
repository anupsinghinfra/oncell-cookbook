# Video script — code-reviewer (75s)

## Hook (0-10s)

**Screen:** A review bot comment: "This may cause issues." — big red X over it. Then a terminal running `grep -c '^+' patch.diff` → `47`.
**VO:** "Most AI code review is vibes: diff in, prose out, nothing checked. This reviewer has a shell. It greps the patch before it opens its mouth."

## The file (10-25s)

**Screen:** `usecases/code-reviewer/agent.js`. Highlight `capabilities: [tools.files, tools.shell]`, then the identity phrase "gather evidence with commands, not vibes", then `{ maxSteps: 20, maxCost: 0.75 }`.
**VO:** "Two capabilities: a durable filesystem and a real shell inside a gVisor sandbox — with no network, because diffs are hostile input. Every review is capped: twenty steps, seventy-five cents, whatever the patch tries."

## Deploy + smoke (25-40s)

**Screen:** `npm run deploy code-reviewer`, then `npm run smoke code-reviewer` → `ok  code-reviewer.review` with the first line `APPROVE - correct fix: page counts need Math.ceil`.
**VO:** "Deploy, smoke-test. The built-in patch is a one-line off-by-one — and it approves it with the right reason."

## Money shot — evidence in the trace (40-65s)

**Screen:** Pipe a real branch diff in with `git diff main | jq -Rs ... | curl .../review`. While it runs, show the run trace in the dashboard: `shell: cat <<'EOF' > patch.diff`, `shell: grep -n 'query(' patch.diff`, then the verdict: `REQUEST CHANGES` with finding #1 "SQL built by string concatenation - db.js:41".
**VO:** "A real branch. Watch the trace: it writes the patch to its workspace, greps for the query call sites, reads the hunk twice — then flags string-concatenated SQL with the file and line. Every command it ran is in the run log. You can audit the review the way the review audits your code."

## CTA (65-75s)

**Screen:** README catalog, code-reviewer row; then `reviews/inbox/` file list growing.
**VO:** "code-reviewer, from oncell-cookbook — it even keeps a durable archive of every verdict. Clone, deploy, pipe your diffs. Link below."
