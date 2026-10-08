/**
 * Make an agent folder, and check one is ready to run.
 *
 *   outreach.ts new  --dir <folder> --id <id> [--label "..."] [--site example.com] [--records ~/.outreach/<id>]
 *   outreach.ts lint --agent <folder>
 *
 * `new` copies templates/ into the folder (agent.yaml, brand.md, voice.md)
 * and never overwrites a file. `lint` lists every CHANGEME left, then loads
 * the agent the way a run does: each channel must plan, each message must
 * render. Exit 0 only when the agent is ready.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { brandFiles, die, loadAgent, scriptsRoot } from "./common.ts";
import { channelOrder, renderMessage, targetsFor } from "./plan.ts";

const MARKER = "CHANGEME";
const FILES = ["agent.yaml", "brand.md", "voice.md"];

export interface NewAgent {
  dir: string;
  id: string;
  label?: string;
  site?: string;
  records?: string;
}

export function newAgent(o: NewAgent): string[] {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(o.id)) die("--id must be lowercase letters, digits and dashes");
  const dir = resolve(o.dir);
  const existing = FILES.map((f) => join(dir, f)).filter((p) => existsSync(p));
  if (existing.length) die(`refusing to overwrite:\n  ${existing.join("\n  ")}`);
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const f of FILES) {
    let text = readFileSync(join(scriptsRoot(), "..", "templates", f), "utf8");
    if (f === "agent.yaml") {
      // Quoted: a label like "Acme: engineering leads" is not plain YAML.
      const q = (v: string) => JSON.stringify(v);
      text = text.replace("id: CHANGEME", `id: ${o.id}`);
      if (o.label) text = text.replace(/^label: .*$/m, () => `label: ${q(o.label!)}`);
      if (o.site) text = text.replace("site: CHANGEME.com", () => `site: ${q(o.site!)}`);
      if (o.records) text = text.replace("records: null", () => `records: ${q(o.records!)}`);
    } else {
      text = text.replace(/^(# \S+ — )CHANGEME/m, `$1${o.id}`);
    }
    writeFileSync(join(dir, f), text, "utf8");
    written.push(join(dir, f));
  }
  // The records hold people's names: keep them out of git by default.
  if (!o.records && !existsSync(join(dir, ".gitignore"))) {
    writeFileSync(join(dir, ".gitignore"), "records/\n", "utf8");
    written.push(join(dir, ".gitignore"));
  }
  return written;
}

export interface LintResult {
  ready: boolean;
  placeholders: Array<{ file: string; lines: number[] }>;
  problems: string[];
  channels: string[];
}

export function lint(agentArg?: string): LintResult {
  const problems: string[] = [];
  const placeholders: LintResult["placeholders"] = [];
  const agent = loadAgent(agentArg);
  let files: string[] = [];
  try {
    const f = brandFiles(agent);
    files = [agent._path as string, f.brand, f.voice];
  } catch (error) {
    problems.push((error as Error).message);
    files = [agent._path as string];
  }
  for (const file of files) {
    const lines = readFileSync(file, "utf8")
      .split("\n")
      .map((line, i) => (line.includes(MARKER) ? i + 1 : 0))
      .filter(Boolean);
    if (lines.length) placeholders.push({ file, lines });
  }

  const channels: string[] = [];
  try {
    for (const c of channelOrder(agent)) {
      try {
        const plan = targetsFor(agent, c.name, new Date());
        const searches = (plan.dispatches as unknown[] | undefined)?.length ?? 0;
        if (!searches) problems.push(`${c.name}: plans no searches today (no keywords, targets, lists, titles or groups)`);
        channels.push(`${c.name} (${c.kind}, ${searches} search(es) today)`);
      } catch (error) {
        problems.push(`${c.name}: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    problems.push((error as Error).message);
  }
  for (const name of Object.keys(agent.messages ?? {})) {
    try {
      renderMessage(agent, name);
    } catch (error) {
      problems.push(`messages.${name}: ${(error as Error).message}`);
    }
  }
  if (!agent.audience.titles.length && Object.values(agent.channels).some((c) => c.kind === "connect")) {
    problems.push("a connect channel needs audience.titles");
  }
  return { ready: !placeholders.length && !problems.length, placeholders, problems, channels };
}
