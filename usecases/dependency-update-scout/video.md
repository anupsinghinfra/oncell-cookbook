# Video script — dependency-update-scout (70s)

## Hook (0-10s)

**Screen:** A GitHub notifications page: 43 unread Dependabot PRs. Cut to a single clean markdown note: "Breaking-change candidates (2) / Routine bumps (7)".
**VO:** "Forty-three robot PRs you'll never read — or one weekly note, ordered by risk, written after someone actually checked the changelogs."

## The file (10-24s)

**Screen:** `usecases/dependency-update-scout/agent.js`. Highlight the wake procedure ending in "call schedule with in set to 7 days and note set to review", then `capabilities: [tools.db, tools.files, tools.memory, tools.schedule, registryLookup]`.
**VO:** "This is the steady cadence — the simplest durable loop there is. No cron expression. Every pass ends by booking the next one, seven days out, as a ledger entry the runtime owns."

## Deploy + load (24-38s)

**Screen:** `npm run deploy dependency-update-scout`, then `curl .../set-deps` with a big JSON array — instant response, "Tracking 212 dependencies." Then `curl .../start -d '{}'`.
**VO:** "Loading two hundred deps is two hundred SQLite upserts — zero tokens. One start call runs the first review and arms the chain."

## Money shot — the week that survives a redeploy (38-60s)

**Screen:** Dashboard: `review · in 7 days`, agent cost $0.00 all week. Mid-week: `npm run deploy dependency-update-scout` ships a tweak. Sunday: the wake fires anyway — run log shows `registry_lookup` calls, then `notes/2026-08-09.md` appears: majors first with why-it-matters, routine list after.
**VO:** "Six days, twenty-three hours: zero dollars, no process running. Redeploy mid-week — doesn't matter, the wake isn't a process. Monday morning: the note is just there."

## CTA (60-70s)

**Screen:** README catalog, dependency-update-scout row.
**VO:** "dependency-update-scout, from oncell-cookbook. Point registry_lookup at npm or PyPI, paste your lockfile, start it once. Link below."
