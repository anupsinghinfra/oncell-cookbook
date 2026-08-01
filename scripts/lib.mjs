/**
 * Shared helpers for the cookbook scripts. Node 20 stdlib only — no deps.
 *
 * - loadEnv(): reads .env at the repo root (KEY=VALUE lines) into a map,
 *   with real environment variables taking precedence.
 * - api(): fetch against the OnCell API with Bearer auth.
 * - listUsecases() / loadUsecase(): read usecases/<slug>/ directories.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const USECASES_DIR = join(ROOT, "usecases");

const DEFAULT_API_URL = "https://api.oncell.ai";

/** Parse .env at the repo root. Real env vars win over file values. */
export function loadEnv() {
  const fileValues = {};
  const envPath = join(ROOT, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      fileValues[key] = value;
    }
  }
  return {
    apiKey: process.env.ONCELL_API_KEY ?? fileValues.ONCELL_API_KEY ?? "",
    apiUrl: process.env.ONCELL_API_URL ?? fileValues.ONCELL_API_URL ?? DEFAULT_API_URL,
  };
}

/** Exit with a friendly message when the API key is missing. */
export function requireEnv() {
  const env = loadEnv();
  if (env.apiKey.length === 0) {
    console.error("ONCELL_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }
  return env;
}

/**
 * Call the OnCell API. Returns { status, body } — body is parsed JSON when
 * possible, raw text otherwise. Throws only on network-level failures.
 */
export async function api(env, path, { method = "GET", body } = {}) {
  const res = await fetch(`${env.apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed };
}

/** Slugs of every use case, sorted for deterministic output. */
export function listUsecases() {
  if (!existsSync(USECASES_DIR)) return [];
  return readdirSync(USECASES_DIR)
    .filter((name) => statSync(join(USECASES_DIR, name)).isDirectory())
    .sort();
}

/** Load one use case: usecase.json, manifest.json, and the agent source. */
export function loadUsecase(slug) {
  const dir = join(USECASES_DIR, slug);
  if (!existsSync(dir)) {
    console.error(`Unknown use case "${slug}". Available: ${listUsecases().join(", ")}`);
    process.exit(1);
  }
  return {
    slug,
    dir,
    usecase: JSON.parse(readFileSync(join(dir, "usecase.json"), "utf8")),
    manifest: JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")),
    source: readFileSync(join(dir, "agent.js"), "utf8"),
  };
}

/** Resolve `<slug>` or `--all` CLI arg into a list of slugs. */
export function resolveSlugsArg(argv, scriptName) {
  const arg = argv[2];
  if (arg === "--all") return listUsecases();
  if (typeof arg === "string" && arg.length > 0) return [arg];
  console.error(`Usage: npm run ${scriptName} <slug>   (or --all)`);
  console.error(`Available: ${listUsecases().join(", ")}`);
  process.exit(1);
}
