#!/usr/bin/env node
/**
 * Check every workflow in this repo before it is published.
 *
 *   node scripts/validate.mjs
 *
 * No dependencies. Exits non-zero and lists what is wrong.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const WORKFLOW_DIR = "workflows";
const SKILL_DIR = "skills";

const TYPES = new Set(["string", "integer", "number", "boolean", "string[]"]);
const PHASE_KINDS = new Set(["task", "read"]);
const PHASE_FIELDS = new Set([
  "title", "kind", "goal", "launch", "steps", "typeTexts", "findTexts",
  "allowWrites", "repeat", "countLabel", "pauseWhen", "maxSteps", "collect",
]);
const COLLECT_FIELDS = new Set(["record", "fields", "count", "judge", "require", "where"]);
const TOP_FIELDS = new Set([
  "name", "title", "summary", "description", "apps", "writes", "reviews",
  "estimatedCredits", "output", "input", "phases",
]);
const SECRET = /\b(sk-[A-Za-z0-9]{16,}|[0-9a-f]{40,}|Bearer\s+[A-Za-z0-9._-]{16,})\b/;

const problems = [];
const warn = [];
const fail = (file, message) => problems.push(`${file}: ${message}`);

/** Every {{placeholder}} in a value, at any depth. */
function placeholders(value, found = new Set()) {
  if (typeof value === "string") {
    for (const m of value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) found.add(m[1]);
  } else if (Array.isArray(value)) {
    for (const v of value) placeholders(v, found);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) placeholders(v, found);
  }
  return found;
}

function checkWorkflow(file, raw) {
  let w;
  try {
    w = JSON.parse(raw);
  } catch (error) {
    return fail(file, `not valid JSON: ${error.message}`);
  }
  if (SECRET.test(raw)) fail(file, "looks like it contains a key or token");

  const stem = file.replace(/\.json$/, "");
  if (w.name !== stem) fail(file, `name is ${JSON.stringify(w.name)} but the file is ${file}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(w.name ?? "")) fail(file, "name must be kebab-case");

  for (const field of ["title", "summary", "description", "output"]) {
    if (typeof w[field] !== "string" || !w[field].trim()) fail(file, `${field} is required`);
  }
  if (w.summary && w.summary.length > 200) warn.push(`${file}: summary is long for a card (${w.summary.length} chars)`);
  if (!Array.isArray(w.apps) || !w.apps.length) fail(file, "apps must list at least one package");
  else for (const app of w.apps) if (!/^[a-zA-Z][\w.]*\.[\w.]+$/.test(app)) fail(file, `apps: ${JSON.stringify(app)} is not a package name`);
  if (typeof w.writes !== "boolean") fail(file, "writes must be true or false");
  if (typeof w.reviews !== "boolean") fail(file, "reviews must be true or false");
  if (!Array.isArray(w.estimatedCredits) || w.estimatedCredits.length !== 2 || w.estimatedCredits.some((n) => typeof n !== "number"))
    fail(file, "estimatedCredits must be [low, high]");
  else if (w.estimatedCredits[0] > w.estimatedCredits[1]) fail(file, "estimatedCredits is the wrong way round");
  for (const key of Object.keys(w)) if (!TOP_FIELDS.has(key)) warn.push(`${file}: unknown field ${key}`);

  // --- input
  const declared = new Set();
  if (!w.input || typeof w.input !== "object" || Array.isArray(w.input)) fail(file, "input must be an object");
  else {
    for (const [name, spec] of Object.entries(w.input)) {
      declared.add(name);
      if (!/^[a-z][A-Za-z0-9_]*$/.test(name)) fail(file, `input.${name}: name must start lowercase`);
      if (!spec || typeof spec !== "object") { fail(file, `input.${name} must be an object`); continue; }
      if (!TYPES.has(spec.type)) fail(file, `input.${name}.type must be one of ${[...TYPES].join(", ")}`);
      if (typeof spec.description !== "string" || !spec.description.trim()) fail(file, `input.${name}.description is required`);
      if (spec.required && "default" in spec) fail(file, `input.${name} is required and also has a default`);
      if (spec.enum && (!Array.isArray(spec.enum) || !spec.enum.length)) fail(file, `input.${name}.enum must be a non-empty array`);
    }
  }

  // --- phases
  if (!Array.isArray(w.phases) || !w.phases.length) return fail(file, "phases must have at least one phase");
  let writes = false;
  let reviews = false;
  w.phases.forEach((p, i) => {
    const at = `phase ${i + 1}`;
    if (!p || typeof p !== "object") return fail(file, `${at} must be an object`);
    for (const key of Object.keys(p)) if (!PHASE_FIELDS.has(key)) warn.push(`${file}: ${at} has unknown field ${key}`);
    if (typeof p.title !== "string" || !p.title.trim()) fail(file, `${at}: title is required`);
    if (!PHASE_KINDS.has(p.kind)) fail(file, `${at}: kind must be task or read`);
    if (typeof p.goal !== "string" || !p.goal.trim()) fail(file, `${at}: goal is required`);
    if (i === 0 && !p.launch) warn.push(`${file}: ${at} has no launch, so it starts from whatever is on screen`);
    if (p.launch && !w.apps.includes(p.launch)) fail(file, `${at}: launches ${p.launch}, which is not in apps`);
    if (p.typeTexts && !Array.isArray(p.typeTexts)) fail(file, `${at}: typeTexts must be an array`);
    if (p.steps && !Array.isArray(p.steps)) fail(file, `${at}: steps must be an array`);
    if (p.repeat !== undefined && !p.countLabel) fail(file, `${at}: repeat needs countLabel to know what to count`);
    if (p.countLabel) { try { new RegExp(p.countLabel, "i"); } catch { fail(file, `${at}: countLabel is not a valid regex`); } }
    if (p.allowWrites) writes = true;
    if (p.pauseWhen) reviews = true;
    if (p.kind === "read" && !p.collect) fail(file, `${at}: a read phase needs a collect spec`);
    if (p.collect) {
      const c = p.collect;
      for (const key of Object.keys(c)) if (!COLLECT_FIELDS.has(key)) warn.push(`${file}: ${at} collect has unknown field ${key}`);
      if (typeof c.record !== "string" || !c.record.trim()) fail(file, `${at}: collect.record is required`);
      if (!c.fields || typeof c.fields !== "object" || !Object.keys(c.fields).length) fail(file, `${at}: collect.fields is required`);
      if (c.count === undefined) fail(file, `${at}: collect.count is required`);
      for (const name of Object.keys(c.require ?? {})) if (!(name in (c.judge ?? {}))) fail(file, `${at}: collect.require.${name} has no matching judge claim`);
    }
  });
  if (writes !== Boolean(w.writes)) fail(file, `writes is ${w.writes} but ${writes ? "a phase sets allowWrites" : "no phase does"}`);
  if (reviews !== Boolean(w.reviews)) fail(file, `reviews is ${w.reviews} but ${reviews ? "a phase sets pauseWhen" : "no phase does"}`);
  if (w.writes && !w.reviews) warn.push(`${file}: writes without a pauseWhen — the caller cannot see it before it acts`);

  // --- placeholders
  const used = placeholders(w.phases);
  for (const name of used) if (!declared.has(name)) fail(file, `{{${name}}} is used but not declared in input`);
  for (const name of declared) if (!used.has(name)) warn.push(`${file}: input.${name} is declared but never used`);

  // --- typed text must come from somewhere
  for (const [i, p] of w.phases.entries()) {
    if (!p.typeTexts?.length) continue;
    for (const t of p.typeTexts) {
      if (typeof t !== "string" || !t.trim()) fail(file, `phase ${i + 1}: typeTexts has an empty entry`);
    }
  }
}

function checkSkills() {
  if (!existsSync(SKILL_DIR)) return;
  for (const dir of readdirSync(SKILL_DIR)) {
    const path = join(SKILL_DIR, dir, "SKILL.md");
    if (!existsSync(path)) { fail(`${SKILL_DIR}/${dir}`, "has no SKILL.md"); continue; }
    const text = readFileSync(path, "utf8");
    if (!text.startsWith("---\n")) fail(path, "has no frontmatter");
    else {
      const front = text.slice(4, text.indexOf("\n---", 4));
      for (const key of ["name", "description"]) if (!new RegExp(`^${key}:`, "m").test(front)) fail(path, `frontmatter has no ${key}`);
      if (!new RegExp(`^name:\\s*${dir}\\s*$`, "m").test(front)) fail(path, `frontmatter name does not match the folder ${dir}`);
    }
    if (SECRET.test(text)) fail(path, "looks like it contains a key or token");
  }
}

const files = existsSync(WORKFLOW_DIR) ? readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".json")) : [];
for (const file of files) checkWorkflow(file, readFileSync(join(WORKFLOW_DIR, file), "utf8"));
checkSkills();

for (const w of warn) console.log(`warning  ${w}`);
for (const p of problems) console.error(`PROBLEM  ${p}`);
console.log(`\n${files.length} workflow${files.length === 1 ? "" : "s"} checked, ${problems.length} problem${problems.length === 1 ? "" : "s"}, ${warn.length} warning${warn.length === 1 ? "" : "s"}`);
process.exit(problems.length ? 1 : 0);
