/**
 * Smoke-test a deployed use case with its declared smokeTask.
 *
 *   npm run smoke support-agent
 *   npm run smoke -- --all
 *
 * Each usecase.json declares `smokeTask: { task, args } | null` — a cheap
 * invocation (at most one small LLM turn) that proves the agent is alive.
 * Null means the use case has no invocation that would finish without
 * parking (e.g. everything waits on a human) — those are skipped.
 *
 * POST /api/v1/agents/<slug>/<task> with the args as the JSON body.
 */

import { requireEnv, api, loadUsecase, resolveSlugsArg } from "./lib.mjs";

const slugs = resolveSlugsArg(process.argv, "smoke");
const env = requireEnv();

let failures = 0;
for (const slug of slugs) {
  const { usecase } = loadUsecase(slug);
  const smokeTask = usecase.smokeTask;

  if (smokeTask === null) {
    console.log(`skipped   ${slug}  (no non-parking smoke task)`);
    continue;
  }

  const { status, body } = await api(env, `/api/v1/agents/${slug}/${smokeTask.task}`, {
    method: "POST",
    body: smokeTask.args,
  });

  if (status === 200) {
    const text = typeof body.text === "string" ? body.text : JSON.stringify(body);
    const cost = typeof body.cost === "number" ? ` ($${body.cost.toFixed(4)})` : "";
    console.log(`ok        ${slug}.${smokeTask.task}${cost}`);
    console.log(`          ${text.split("\n")[0].slice(0, 160)}`);
  } else {
    failures += 1;
    console.error(`FAILED    ${slug}.${smokeTask.task}  (HTTP ${status})`);
    console.error(`          ${JSON.stringify(body.error ?? body).slice(0, 300)}`);
  }
}

process.exit(failures > 0 ? 1 : 0);
