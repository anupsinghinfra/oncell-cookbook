/**
 * List your deployed agents.
 *
 *   npm run list
 *
 * GET /api/v1/agents — name, version, status, deploy time.
 */

import { requireEnv, api } from "./lib.mjs";

const env = requireEnv();
const { status, body } = await api(env, "/api/v1/agents");

if (status !== 200) {
  console.error(`Failed to list agents (HTTP ${status}): ${JSON.stringify(body.error ?? body)}`);
  process.exit(1);
}

const agents = Array.isArray(body.agents) ? body.agents : [];
if (agents.length === 0) {
  console.log("No agents deployed yet. Try: npm run deploy support-agent");
  process.exit(0);
}

for (const agent of agents) {
  console.log(`${agent.name}  v${agent.version}  ${agent.status}  deployed ${agent.deployedAt}`);
}
