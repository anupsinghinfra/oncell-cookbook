# Catalog contract — the next 16 use cases

This file is the work order for expanding the cookbook past its five
flagships. Each row below is a **reserved slug**: build it as
`usecases/<slug>/` with the standard five files (`agent.js`,
`manifest.json`, `usecase.json`, `blog.md`, `video.md`) — copy `TEMPLATE/`
to start. Do not rename slugs; other tasks and links depend on them.

## Ground rules (same bar as the flagships)

1. **Real APIs only.** Prebuilt capabilities are exactly: `memory`, `db`,
   `files`, `shell`, `secrets`, `ask_human`, `agents`, `cells`, `schedule`.
   Anything that talks to the outside world (HTTP, email, Slack, payment
   APIs) must be a clearly-marked inline **stub** custom tool — the sandbox
   has no network of its own.
2. **Identity instructions must stand alone** — on the deployed platform
   they drive a managed loop and task args arrive as a JSON prompt.
   Describe every task's input shape and exact answer format.
3. **Instruction strings are single JSON-style literals** in `agent.js`,
   duplicated verbatim in `manifest.json`. `npm run validate` enforces the
   sync byte-for-byte and mirrors the API's deploy-time schema — it must
   pass before you're done.
4. **smokeTask is cheap**: at most one small LLM turn; `null` only when
   every invocation would park on a human.
5. Agent name in `new Agent("...")` = directory slug = `usecase.json` slug
   = `blog.md` frontmatter slug.

## Reserved slugs

| Slug | One-liner | Primitives to show |
|---|---|---|
| `standup-collector` | Pings each teammate for their update (stub messenger), compiles the standup, posts it on schedule. | `schedule`, `memory`, `agents` |
| `invoice-chaser` | Politely escalating payment reminders that sleep between nudges and stop the moment payment lands. | `schedule`, `db`, `ask_human` |
| `price-monitor` | Watches competitor prices via a stub fetcher, records history in SQLite, flags moves above a threshold. | `schedule`, `db`, custom-tool stub |
| `uptime-watchdog` | Probes endpoints via a stub checker, remembers incident state, and only alerts on state *changes*. | `schedule`, `memory`, custom-tool stub |
| `lead-qualifier` | Scores inbound leads against an ICP rubric packaged as a skill; asks a human only on borderline scores. | `skills`, `ask_human`, `db` |
| `content-repurposer` | Turns one blog post into a thread, a LinkedIn post, and a newsletter blurb — voice rules as a skill. | `skills`, `files` |
| `seo-brief-writer` | Produces a full content brief (outline, entities, FAQs) from a keyword + stub SERP data, archived to files. | `files`, `skills`, custom-tool stub |
| `review-responder` | Drafts on-brand replies to app-store/G2 reviews; negative reviews require human sign-off before send. | `skills`, `ask_human`, `memory` |
| `onboarding-emailer` | Runs a per-user onboarding sequence: schedules each next touch, skips users who activated. | `schedule`, `memory.forUser`, custom-tool stub |
| `report-generator` | Compiles a weekly metrics report from rows accumulated in its SQLite db into a polished markdown file. | `db`, `files`, `schedule` |
| `release-notes-writer` | Turns a pasted commit log or diff into customer-facing release notes, house style as a skill. | `skills`, `files`, `shell` |
| `competitor-watcher` | Tracks competitor changelogs/pages via stub fetcher, diffs against memory, digests only what changed. | `memory`, `schedule`, custom-tool stub |
| `faq-builder` | Ingests support transcripts task-by-task, clusters recurring questions in its db, emits a ranked FAQ. | `db`, `files`, `llm-loop` |
| `meeting-scheduler` | Negotiates a meeting time over a stub calendar/email tool, parking between counter-proposals. | `ask_human`, `memory`, custom-tool stub |
| `data-cleaner` | Normalizes messy CSV/JSON dropped into its files — dedupe, canonical formats — cleaning rules as a skill. | `files`, `shell`, `skills` |
| `churn-detector` | Ingests product-usage events into SQLite, scores accounts weekly against a churn rubric, flags the risky ones. | `db`, `schedule`, `skills` |

## Scheduled agents

A 16-agent collection built around the `schedule` primitive. Each one
demonstrates a **distinct scheduling pattern**, named and explained in its
blog. Shared conventions on top of the ground rules above: a wake-note
protocol in every identity ("a note reading X means..."), an explicit
`start`/`stop` task pair for every self-rebooking chain (`stop` is a
zero-LLM state flag the next wake reads and obeys — stand-down through
state, never cancellation), zero-LLM ingest/config paths wherever data
enters, and smoke tasks that never start a wake chain.

| Slug | Scheduling pattern | One-liner |
|---|---|---|
| `cert-expiry-sentinel` | Deadline countdown — wakes at computed absolute `at` instants | Escalating 30/7/1-day expiry warnings, each fired at the exact threshold moment. |
| `dependency-update-scout` | Steady cadence — the simplest self-rebooking chain | Weekly registry sweep ending in a risk-ordered upgrade note. |
| `social-scheduler` | Interleaved cadences — two note-dispatched chains, one agent | Daily publish from a queued-posts table + weekly engagement rollup. |
| `backup-auditor` | Cadence with a human gate — fast automated loop + slow loop that parks | Daily backup verify (haiku) + monthly restore drill on `ask_human`. |
| `kpi-anomaly-watcher` | Wake-and-compare — baselines in memory, silence as the default | Daily z-score pass over free-streaming metrics; alerts only past 2.5 sigma. |
| `meeting-prep-briefer` | Weekday-only self-rebooking — computed next-weekday `at` | Weekday-morning calendar briefs; Friday books Monday. |
| `subscription-auditor` | Long-period cadence — a 30-day chain that cannot rot | Monthly SaaS ledger sweep; every cancellation gated behind a human. |
| `crm-touch-cadence` | Decay scoring at wake — no per-item timers, rank at read time | Daily pick of the 3 coldest relationships, openers drafted. |
| `content-calendar-planner` | Planner/executor split — expensive weekly wake writes, cheap daily wake reads | Weekly plan file + daily reminder wakes that only read it. |
| `retro-facilitator` | Multi-phase cycle — one event across phased wakes (open → remind → close) | Biweekly retro window with mid-window nudge and closing synthesis. |
| `oncall-handoff-writer` | Report-at-boundary — free ingest all period, judgment at the edge | Weekly handoff doc compiled from the incident log at rotation turn. |
| `seo-rank-tracker` | Two-speed telemetry — fine ingest cadence + coarse analysis cadence | Daily haiku position logging + weekly trend report. |
| `flashcard-coach` | **Per-item wake chains** (flagship) — every row owns its own timeline | SM-2 spaced repetition; each card books its own next review wake. |
| `stale-pr-nagger` | Fatigue-aware cadence — per-recipient memory rations the reminders | Weekday-morning PR nags: one bundled message per reviewer, three per week. |
| `data-retention-janitor` | Self-maintenance cadence — the agent is its own operand | Weekly sweep of its own db/files by declared rules, with purge receipts. |
| `news-briefing` | Preference-tuned cadence — fixed clock, drifting state | Daily brief whose topic weights are tuned by zero-LLM reader feedback. |

## When you finish a batch

Run `npm run validate` (must pass with zero problems), then
`npm run catalog` to regenerate the README table. Blogs: 600–900 words,
anchored to real lines in your `agent.js`, ending with the deploy + invoke
commands and a "what you didn't have to build" close. Videos: 60–90
seconds, hook → file → deploy → money shot → CTA (see any flagship's
`video.md`).
