/**
 * Validate every use case. Run before deploying or opening a PR:
 *
 *   npm run validate
 *
 * For each usecases/<slug>/ this checks:
 *
 * 1. All four content files exist (agent.js, manifest.json, usecase.json,
 *    blog.md, video.md — the manifest makes five on disk).
 * 2. agent.js parses (`node --check`) and declares `new Agent("<slug>", ...)`.
 * 3. manifest.json matches OnCell's deploy-time AgentManifestSchema exactly
 *    (strict keys, capability enum, kebab-case skill names, 200-char skill
 *    descriptions) — the same rules the API enforces with a 400.
 * 4. agent.js and manifest.json agree: every instruction string in the
 *    manifest appears verbatim in the source (instruction constants are
 *    written as JSON-style literals for exactly this reason), and every
 *    declared capability appears as `tools.<name>` in the source.
 * 5. usecase.json has the catalog contract shape, blog.md has frontmatter.
 *
 * Node 20 stdlib only. No network calls.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { USECASES_DIR, listUsecases } from "./lib.mjs";

// Mirrors PREBUILT_CAPABILITIES in OnCell's api-server validation.
const CAPABILITIES = ["memory", "db", "files", "shell", "secrets", "ask_human", "agents", "cells", "schedule"];
const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SKILL_DESCRIPTION_MAX = 200;
const REQUIRED_FILES = ["agent.js", "manifest.json", "usecase.json", "blog.md", "video.md"];
const FRONTMATTER_KEYS = ["title", "description", "date", "slug"];

const errors = [];
const fail = (slug, message) => errors.push(`${slug}: ${message}`);

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;

/** Strict-object check: no keys beyond `allowed` (mirrors zod .strict()). */
function checkKeys(slug, label, value, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(slug, `${label}: unknown key "${key}"`);
  }
}

// ─── manifest.json — mirror of AgentManifestSchema ─────────────────────────

function validateManifest(slug, manifest) {
  if (!isPlainObject(manifest)) return fail(slug, "manifest.json must be an object");
  checkKeys(slug, "manifest", manifest, ["identity", "capabilities", "skills"]);

  const { identity, capabilities, skills } = manifest;

  if (!isPlainObject(identity)) {
    fail(slug, "manifest.identity must be an object");
  } else {
    checkKeys(slug, "manifest.identity", identity, ["instructions", "model", "budgets"]);
    if (!isNonEmptyString(identity.instructions)) fail(slug, "manifest.identity.instructions is required");
    if (identity.model !== undefined && !isNonEmptyString(identity.model)) {
      fail(slug, "manifest.identity.model must be a non-empty string");
    }
    if (identity.budgets !== undefined) {
      if (!isPlainObject(identity.budgets)) {
        fail(slug, "manifest.identity.budgets must be an object");
      } else {
        checkKeys(slug, "manifest.identity.budgets", identity.budgets, ["perDayCents"]);
        const cents = identity.budgets.perDayCents;
        if (cents !== undefined && (!Number.isInteger(cents) || cents <= 0)) {
          fail(slug, "manifest.identity.budgets.perDayCents must be a positive integer");
        }
      }
    }
  }

  if (!Array.isArray(capabilities)) {
    fail(slug, "manifest.capabilities must be an array");
  } else {
    for (const capability of capabilities) {
      if (!CAPABILITIES.includes(capability)) {
        fail(slug, `manifest.capabilities: "${capability}" is not one of ${CAPABILITIES.join(", ")}`);
      }
    }
  }

  if (!Array.isArray(skills)) {
    fail(slug, "manifest.skills must be an array");
  } else {
    for (const [i, skill] of skills.entries()) {
      if (!isPlainObject(skill)) { fail(slug, `manifest.skills[${i}] must be an object`); continue; }
      checkKeys(slug, `manifest.skills[${i}]`, skill, ["name", "description", "instructions", "tools"]);
      if (!isNonEmptyString(skill.name) || !KEBAB_CASE.test(skill.name)) {
        fail(slug, `manifest.skills[${i}].name must be kebab-case`);
      }
      if (!isNonEmptyString(skill.description)) {
        fail(slug, `manifest.skills[${i}].description is required`);
      } else if (skill.description.length > SKILL_DESCRIPTION_MAX) {
        fail(slug, `manifest.skills[${i}].description exceeds ${SKILL_DESCRIPTION_MAX} chars (it rides in base context on every run)`);
      }
      if (!isNonEmptyString(skill.instructions)) fail(slug, `manifest.skills[${i}].instructions is required`);
      if (!Array.isArray(skill.tools) || skill.tools.some((tool) => !isNonEmptyString(tool))) {
        fail(slug, `manifest.skills[${i}].tools must be an array of non-empty strings`);
      }
    }
  }
}

// ─── usecase.json — the catalog contract ───────────────────────────────────

function validateUsecase(slug, usecase) {
  if (!isPlainObject(usecase)) return fail(slug, "usecase.json must be an object");
  checkKeys(slug, "usecase", usecase, ["slug", "title", "oneLiner", "primitives", "smokeTask"]);

  if (usecase.slug !== slug) fail(slug, `usecase.slug ("${usecase.slug}") must equal the directory name`);
  if (!isNonEmptyString(usecase.title)) fail(slug, "usecase.title is required");
  if (!isNonEmptyString(usecase.oneLiner)) fail(slug, "usecase.oneLiner is required");
  if (!Array.isArray(usecase.primitives) || usecase.primitives.length === 0 ||
      usecase.primitives.some((p) => !isNonEmptyString(p))) {
    fail(slug, "usecase.primitives must be a non-empty array of strings");
  }

  if (usecase.smokeTask !== null) {
    if (!isPlainObject(usecase.smokeTask)) {
      fail(slug, "usecase.smokeTask must be { task, args } or null");
    } else {
      checkKeys(slug, "usecase.smokeTask", usecase.smokeTask, ["task", "args"]);
      if (!isNonEmptyString(usecase.smokeTask.task)) fail(slug, "usecase.smokeTask.task is required");
      if (!isPlainObject(usecase.smokeTask.args)) fail(slug, "usecase.smokeTask.args must be an object");
    }
  }
}

// ─── agent.js ↔ manifest.json sync ─────────────────────────────────────────

function validateAgentSource(slug, source, manifest) {
  const check = spawnSync(process.execPath, ["--check", join(USECASES_DIR, slug, "agent.js")], { encoding: "utf8" });
  if (check.status !== 0) fail(slug, `agent.js failed node --check:\n${check.stderr.trim()}`);

  // Same extraction the deploy route uses: new Agent("name", ...).
  const nameMatch = source.match(/new\s+Agent\s*\(\s*["']([^"']+)["']/);
  if (!nameMatch) {
    fail(slug, 'agent.js must construct `new Agent("<slug>", ...)`');
  } else if (nameMatch[1] !== slug) {
    fail(slug, `agent name "${nameMatch[1]}" must equal the directory slug "${slug}"`);
  }
  if (!/export\s+default\s+agent/.test(source)) fail(slug, "agent.js must `export default agent`");

  if (!isPlainObject(manifest)) return;

  // Instruction strings are authored as JSON-style literals in agent.js so
  // the manifest can be checked byte-for-byte against the source.
  const literals = [
    ["identity.instructions", manifest.identity?.instructions],
    ...(Array.isArray(manifest.skills)
      ? manifest.skills.flatMap((skill, i) => [
          [`skills[${i}].description`, skill.description],
          [`skills[${i}].instructions`, skill.instructions],
        ])
      : []),
  ];
  for (const [label, value] of literals) {
    if (isNonEmptyString(value) && !source.includes(JSON.stringify(value))) {
      fail(slug, `manifest ${label} does not appear verbatim in agent.js — the two files are out of sync`);
    }
  }

  if (Array.isArray(manifest.capabilities)) {
    for (const capability of manifest.capabilities) {
      if (!source.includes(`tools.${capability}`)) {
        fail(slug, `manifest declares capability "${capability}" but agent.js never references tools.${capability}`);
      }
    }
  }
}

// ─── blog.md frontmatter ───────────────────────────────────────────────────

function validateBlog(slug, blog) {
  const frontmatter = blog.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) return fail(slug, "blog.md must start with --- frontmatter ---");
  for (const key of FRONTMATTER_KEYS) {
    const line = frontmatter[1].split("\n").find((l) => l.startsWith(`${key}:`));
    if (!line || line.slice(key.length + 1).trim().length === 0) {
      fail(slug, `blog.md frontmatter is missing "${key}"`);
    }
  }
  const slugLine = frontmatter[1].split("\n").find((l) => l.startsWith("slug:"));
  if (slugLine && slugLine.slice(5).trim() !== slug) {
    fail(slug, "blog.md frontmatter slug must equal the directory name");
  }
}

// ─── Run ───────────────────────────────────────────────────────────────────

const slugs = listUsecases();
if (slugs.length === 0) {
  console.error("No use cases found under usecases/.");
  process.exit(1);
}

for (const slug of slugs) {
  const dir = join(USECASES_DIR, slug);

  if (!KEBAB_CASE.test(slug)) fail(slug, "directory name must be kebab-case");

  const missing = REQUIRED_FILES.filter((file) => !existsSync(join(dir, file)));
  if (missing.length > 0) {
    fail(slug, `missing files: ${missing.join(", ")}`);
    continue;
  }

  let usecase, manifest;
  try { usecase = JSON.parse(readFileSync(join(dir, "usecase.json"), "utf8")); }
  catch (e) { fail(slug, `usecase.json is not valid JSON: ${e.message}`); }
  try { manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")); }
  catch (e) { fail(slug, `manifest.json is not valid JSON: ${e.message}`); }

  if (usecase !== undefined) validateUsecase(slug, usecase);
  if (manifest !== undefined) validateManifest(slug, manifest);
  validateAgentSource(slug, readFileSync(join(dir, "agent.js"), "utf8"), manifest);
  validateBlog(slug, readFileSync(join(dir, "blog.md"), "utf8"));

  const video = readFileSync(join(dir, "video.md"), "utf8");
  if (video.trim().length === 0) fail(slug, "video.md is empty");
}

if (errors.length > 0) {
  console.error(`FAIL — ${errors.length} problem(s):\n`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`OK — ${slugs.length} use case(s) valid: ${slugs.join(", ")}`);
