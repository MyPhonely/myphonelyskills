#!/usr/bin/env node
/**
 * Check every skill in this repo before it is published.
 *
 *   node scripts/validate.mjs
 *
 * No dependencies. Exits non-zero and lists what is wrong.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SKILL_DIR = "skills";
const REQUIRED = ["name", "description"];
const WORKFLOW_REQUIRED = ["title", "apps", "writes", "reviews"];
const KNOWN = new Set([...REQUIRED, ...WORKFLOW_REQUIRED, "kind"]);
const SECRET = /\b(sk-[A-Za-z0-9]{16,}|[0-9a-f]{40,}|Bearer\s+[A-Za-z0-9._-]{16,})\b/;

const problems = [];
const warnings = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

/** Flat `key: value` frontmatter. Deliberately not YAML: keep it simple enough to parse anywhere. */
function frontmatter(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---", 4);
  if (end < 0) return null;
  const fields = {};
  for (const line of text.slice(4, end).split("\n")) {
    if (!line.trim()) continue;
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!m) { fields.__malformed = line.trim(); continue; }
    fields[m[1]] = m[2].trim();
  }
  return { fields, body: text.slice(end + 4) };
}

const bool = (v) => (v === "true" ? true : v === "false" ? false : null);

function checkSkill(dir) {
  const where = `${SKILL_DIR}/${dir}`;
  const path = join(SKILL_DIR, dir, "SKILL.md");
  if (!existsSync(path)) return fail(where, "has no SKILL.md");
  const text = readFileSync(path, "utf8");
  if (SECRET.test(text)) fail(where, "looks like it contains a key or token");

  const parsed = frontmatter(text);
  if (!parsed) return fail(where, "has no frontmatter");
  const { fields, body } = parsed;
  if (fields.__malformed) fail(where, `frontmatter line is not "key: value": ${fields.__malformed}`);

  for (const key of REQUIRED) if (!fields[key]) fail(where, `frontmatter has no ${key}`);
  if (fields.name && fields.name !== dir) fail(where, `frontmatter name is ${fields.name} but the folder is ${dir}`);
  if (fields.name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name)) fail(where, "name must be kebab-case");
  if (fields.description && fields.description.length < 40) warn(where, "description is short; it is what an agent reads to decide the skill applies");
  for (const key of Object.keys(fields)) if (key !== "__malformed" && !KNOWN.has(key)) warn(where, `unknown frontmatter field ${key}`);

  if (fields.kind && fields.kind !== "workflow") fail(where, `kind must be "workflow" when present, got ${fields.kind}`);
  if (fields.kind !== "workflow") {
    for (const key of WORKFLOW_REQUIRED) if (fields[key]) warn(where, `${key} is a catalog field but kind is not workflow`);
    return;
  }

  // --- a workflow is also a catalog listing
  for (const key of WORKFLOW_REQUIRED) if (fields[key] === undefined) fail(where, `a workflow needs ${key} in its frontmatter`);
  if (fields.title && fields.title.length > 70) warn(where, `title is long for a card (${fields.title.length} chars)`);
  for (const app of (fields.apps ?? "").split(",").map((a) => a.trim()).filter(Boolean)) {
    if (!/^[a-zA-Z][\w.]*\.[\w.]+$/.test(app)) fail(where, `apps: ${app} is not an Android package name`);
  }

  const writes = bool(fields.writes);
  const reviews = bool(fields.reviews);
  if (writes === null) fail(where, "writes must be true or false");
  if (reviews === null) fail(where, "reviews must be true or false");

  // --- the body must show the caller how to run it, and declare what it does
  for (const heading of ["## Inputs", "## Run it"]) {
    if (!body.includes(heading)) fail(where, `body has no "${heading}" section`);
  }
  const acts = /"allowWrites"\s*:\s*true|allowWrites:\s*true/.test(body);
  const pauses = /pauseWhen/.test(body);
  if (writes === false && acts) fail(where, "writes is false but the body sets allowWrites");
  if (writes === true && !acts) warn(where, "writes is true but the body never sets allowWrites");
  if (reviews === false && pauses) fail(where, "reviews is false but the body uses pauseWhen");
  if (reviews === true && !pauses) warn(where, "reviews is true but the body never uses pauseWhen");
  if (writes && !reviews) warn(where, "writes without a pause: the user cannot see it before it acts");
  if (!/typeTexts/.test(body) && /type|search for|comment/i.test(body)) {
    warn(where, "the body types or searches but never names typeTexts; the operator cannot compose text");
  }
}

if (!existsSync(SKILL_DIR)) {
  console.error(`no ${SKILL_DIR}/ directory`);
  process.exit(1);
}
const dirs = readdirSync(SKILL_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
for (const dir of dirs) checkSkill(dir);

for (const w of warnings) console.log(`warning  ${w}`);
for (const p of problems) console.error(`PROBLEM  ${p}`);
const n = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
console.log(`\n${n(dirs.length, "skill")} checked, ${n(problems.length, "problem")}, ${n(warnings.length, "warning")}`);
process.exit(problems.length ? 1 : 0);
