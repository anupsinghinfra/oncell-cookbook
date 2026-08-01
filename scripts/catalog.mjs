/**
 * Regenerate the catalog table in README.md from usecases/<slug>/usecase.json.
 *
 *   npm run catalog
 *
 * Deterministic: use cases sorted by slug, rows generated from usecase.json
 * only. The table replaces whatever sits between the markers:
 *
 *   <!-- catalog:start -->
 *   <!-- catalog:end -->
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, listUsecases, loadUsecase } from "./lib.mjs";

const START_MARKER = "<!-- catalog:start -->";
const END_MARKER = "<!-- catalog:end -->";

const rows = listUsecases().map((slug) => {
  const { usecase } = loadUsecase(slug);
  const primitives = usecase.primitives.map((p) => `\`${p}\``).join(" ");
  return `| [\`${slug}\`](usecases/${slug}/agent.js) | ${usecase.oneLiner} | ${primitives} | [blog](usecases/${slug}/blog.md) | [video](usecases/${slug}/video.md) |`;
});

const table = [
  "| Agent | What it does | Primitives it shows | Blog | Video |",
  "|---|---|---|---|---|",
  ...rows,
].join("\n");

const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");

const startIndex = readme.indexOf(START_MARKER);
const endIndex = readme.indexOf(END_MARKER);
if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
  console.error(`README.md is missing the ${START_MARKER} / ${END_MARKER} markers.`);
  process.exit(1);
}

const updated =
  readme.slice(0, startIndex + START_MARKER.length) +
  "\n" + table + "\n" +
  readme.slice(endIndex);

if (updated === readme) {
  console.log(`Catalog up to date (${rows.length} use cases).`);
} else {
  writeFileSync(readmePath, updated);
  console.log(`Catalog regenerated (${rows.length} use cases).`);
}
