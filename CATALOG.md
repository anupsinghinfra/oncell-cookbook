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

## When you finish a batch

Run `npm run validate` (must pass with zero problems), then
`npm run catalog` to regenerate the README table. Blogs: 600–900 words,
anchored to real lines in your `agent.js`, ending with the deploy + invoke
commands and a "what you didn't have to build" close. Videos: 60–90
seconds, hook → file → deploy → money shot → CTA (see any flagship's
`video.md`).
