/**
 * Deploy a use case to OnCell.
 *
 *   npm run deploy support-agent
 *   npm run deploy -- --all
 *
 * POSTs /api/v1/deploy with { source, agentName, manifest }:
 *   - source     usecases/<slug>/agent.js, verbatim
 *   - agentName  the slug (agent.js declares the same name — validate.mjs enforces it)
 *   - manifest   usecases/<slug>/manifest.json, verbatim
 *
 * manifest.json is the deploy-time contract (identity / capabilities /
 * skills) and MUST stay in sync with agent.js. `npm run validate` checks
 * that byte-for-byte before you ship.
 */

import { requireEnv, api, loadUsecase, resolveSlugsArg } from "./lib.mjs";

const slugs = resolveSlugsArg(process.argv, "deploy");
const env = requireEnv();

let failures = 0;
for (const slug of slugs) {
  const { source, manifest } = loadUsecase(slug);
  const { status, body } = await api(env, "/api/v1/deploy", {
    method: "POST",
    body: { source, agentName: slug, manifest },
  });

  if (status === 200 && body.agentName) {
    console.log(`deployed  ${body.agentName}  v${body.version}  ${body.url}`);
  } else {
    failures += 1;
    console.error(`FAILED    ${slug}  (HTTP ${status})`);
    console.error(`          ${JSON.stringify(body.details ?? body.error ?? body)}`);
  }
}

process.exit(failures > 0 ? 1 : 0);
