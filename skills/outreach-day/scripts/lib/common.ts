/**
 * Shared helpers for the outreach-day scripts.
 *
 * An outreach agent is a folder the user owns:
 *
 *   <agent>/agent.yaml   who to reach, channels, limits, offer, messages
 *   <agent>/brand.md     what may and may not be said (overrides everything)
 *   <agent>/voice.md     how it sounds
 *   <agent>/*.md         anything else the agent should read (link lists, ...)
 *   <agent>/records/     the ledgers and each day's reservations
 *
 * Path resolution:
 *   - agent   : --agent <folder or agent.yaml>, else $OUTREACH_AGENT
 *   - records : $OUTREACH_STATE, else agent.yaml `records:` (relative to the
 *               folder, ~ allowed), else <agent>/records
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import type { ParseArgsConfig } from "node:util";

import { parse as parseYaml } from "yaml";

export const LEDGERS = {
  people: "linkedin-outreach.md",
  queue: "social-outreach-queue.md",
  dedup: "commented-posts.md",
} as const;

export type LedgerName = keyof typeof LEDGERS;

export interface Rotation {
  dimension?: string;
  per_day?: number;
  values?: string[];
  /** YYYY-MM-DD. The day the first block of `values` runs; defaults to EPOCH. */
  start?: string;
}

/**
 * Two schools in one search: each rotation value (a US school, say) is
 * searched together with each of today's `values` (foreign schools), so the
 * people found have both on their profile. LinkedIn treats the pair as a
 * relevance hint, not a filter, so the cards still go through card_filter.
 */
export interface Pair {
  values?: string[];
  per_day?: number;
  /** YYYY-MM-DD, as for rotate.start. */
  start?: string;
  /**
   * The search text; {value} is the rotation value, {value_short} the same
   * without "University (of)", {pair} the paired one. Default "PhD {value} {pair}".
   */
  query?: string;
}

/** Which search-result cards to keep, judged from the card alone (no profile opened). */
export interface CardFilter {
  /** "us" for the built-in United States matcher, or substrings of the card's location. */
  location?: "us" | string[];
  /** Keep only headlines containing one of these (case-insensitive, "Ph.D." reads as "phd"). */
  headline_any?: string[];
  /** Drop headlines containing any of these, after "ex-", "prev", "former" and "intern" parts are set aside. */
  headline_none?: string[];
}

export interface Audience {
  titles: string[];
  exclude_headlines?: string[];
  rotate?: Rotation;
  pair?: Pair;
  card_filter?: CardFilter;
  /** Legacy shape, kept so configs verified against live data keep working. */
  schools?: string[];
  schools_per_day?: number;
}

export interface Channel {
  kind?: "connect" | "comment";
  [key: string]: unknown;
}

export interface Agent {
  id: string;
  label?: string;
  /** Where the records live; relative to the agent folder. Default: records/. */
  records?: string | null;
  order?: string[];
  audience: Audience;
  channels: Record<string, Channel>;
  offer?: Record<string, unknown>;
  messages?: Record<string, string>;
  /** The agent.yaml this was loaded from; set by loadAgent. */
  _path?: string;
}

/** The scripts/ directory of this skill. */
export function scriptsRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

/** The agent's folder: the directory holding its agent.yaml. */
export function agentDir(agent: Agent): string {
  if (!agent._path) return die("agent was not loaded from a file");
  return dirname(resolve(agent._path));
}

// Set once per process by a CLI that took --agent, so the command functions can
// call ledgerPath() without threading the agent through every signature.
let currentAgent: Agent | null = null;

export function setCurrentAgent(agent: Agent | null): void {
  currentAgent = agent;
}

/** A failure the CLI reports and exits on, rather than a crash. */
export class KitError extends Error {
  code: number;
  constructor(message: string, code = 2) {
    super(message);
    this.name = "KitError";
    this.code = code;
  }
}

/**
 * Stop with a readable message. Throws rather than exiting so these functions
 * stay usable as a library and testable in-process; `cli()` turns it into the
 * exit status.
 */
export function die(msg: string, code = 2): never {
  throw new KitError(msg, code);
}

/** Entry point for every script: run main, report a KitError, set the status. */
export function cli(main: (argv: string[]) => number | Promise<number>): void {
  Promise.resolve()
    .then(() => main(process.argv.slice(2)))
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      if (error instanceof KitError) {
        console.error(`error: ${error.message}`);
        process.exit(error.code);
      }
      console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
      process.exit(1);
    });
}

/**
 * Where the agent's records live.
 *
 * Precedence: $OUTREACH_STATE, then agent.yaml `records:`, then
 * <agent>/records. Give each agent its own: two agents sharing records would
 * interleave their ledgers.
 */
export function stateDir(agent?: Agent | null): string {
  const env = process.env.OUTREACH_STATE;
  if (env) return resolve(expandHome(env));
  const a = agent ?? currentAgent;
  if (!a) return die("no agent loaded; pass --agent <folder> or set $OUTREACH_AGENT");
  if (a.records) return resolve(agentDir(a), expandHome(a.records));
  return join(agentDir(a), "records");
}

function expandHome(p: string): string {
  return p.startsWith("~") ? join(homedir(), p.slice(1)) : p;
}

/**
 * The agent's own documents: brand.md and voice.md, plus any other .md in the
 * folder (a link list, notes). An agent reads all of them before it writes.
 * README.md is for the people who keep the folder, not the agent, so it is
 * left out.
 */
export function brandFiles(agent: Agent): { brand: string; voice: string; other: string[] } {
  const dir = agentDir(agent);
  const brand = join(dir, "brand.md");
  const voice = join(dir, "voice.md");
  for (const f of [brand, voice]) if (!existsSync(f)) die(`the agent has no ${f}; every agent needs brand.md and voice.md`);
  const other = readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !["brand.md", "voice.md", "README.md"].includes(f))
    .sort()
    .map((f) => join(dir, f));
  return { brand, voice, other };
}

function isDir(p: string): boolean {
  try {
    readdirSync(p);
    return true;
  } catch {
    return false;
  }
}

export function ledgerPath(which: LedgerName, agent?: Agent | null): string {
  const name = LEDGERS[which];
  if (!name) die(`unknown ledger ${JSON.stringify(which)}; expected one of ${Object.keys(LEDGERS).join(", ")}`);
  return join(stateDir(agent), name);
}

/** Load an agent: its folder, or its agent.yaml. Falls back to $OUTREACH_AGENT. */
export function loadAgent(arg?: string | null): Agent {
  const name = arg || process.env.OUTREACH_AGENT || "";
  if (!name) return die("no agent given; pass --agent <folder> or set $OUTREACH_AGENT");
  let path = resolve(expandHome(name));
  if (isDir(path)) path = join(path, "agent.yaml");
  if (!existsSync(path) || !isFile(path)) return die(`no agent.yaml at ${path}`);
  const data = parseYaml(readFileSync(path, "utf8")) as Agent;
  if (!data || typeof data !== "object") return die(`${path} is empty or not a mapping`);
  if (!data.id) return die(`${path} has no id`);
  if (!data.channels || typeof data.channels !== "object") return die(`${path} has no channels`);
  data.audience ??= { titles: [] };
  data.audience.titles ??= [];
  data._path = path;
  return data;
}

function isFile(p: string): boolean {
  try {
    return readFileSync(p) !== null;
  } catch {
    return false;
  }
}

/**
 * Pipe-delimited data rows as [1-indexed line number, text].
 *
 * Skips headings, prose, fenced blocks and `#` audit comments, all of which
 * appear in these ledgers alongside the rows.
 */
export function dataRows(path: string): Array<[number, string]> {
  if (!existsSync(path)) return [];
  const out: Array<[number, string]> = [];
  let fenced = false;
  readFileSync(path, "utf8")
    .split("\n")
    .forEach((raw, i) => {
      const line = raw.replace(/\s+$/, "");
      const t = line.trim();
      if (t.startsWith("```")) {
        fenced = !fenced;
        return;
      }
      if (fenced || !t) return;
      if (t.startsWith("#")) return;
      if (!line.includes("|")) return;
      // These ledgers document their own format in prose above the rows, and
      // that prose contains backtick-quoted pipes. A data row never starts
      // with a markdown list or quote marker, and never contains a backtick.
      if ("-*+>|".includes(t[0])) return;
      if (line.includes("`")) return;
      out.push([i + 1, line]);
    });
  return out;
}

export function fields(row: string): string[] {
  return row.split("|").map((c) => c.trim());
}

/** Sanitize free text for a pipe-delimited cell. */
export function clean(text: string): string {
  return text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

/**
 * Stable post identity: lowercased, non-word characters stripped, first N.
 *
 * Keeps CJK (the classes are unicode-aware), drops spaces, punctuation and
 * emoji, so a title typed back by hand still resolves to the same key.
 */
export function titleKey(title: string, length = 24): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .replace(/_/g, "")
    .slice(0, length);
}

/**
 * Tolerant comparison of two title-keys.
 *
 * Some rows were keyed by hand and are slightly off: one kept a hyphen the
 * rule strips, another cut a character short. Exact equality would make dedup
 * MISS those posts and comment them twice, which is the one failure mode dedup
 * exists to prevent. So normalize both sides again and accept a prefix match,
 * with a floor so short keys cannot collide.
 */
export function keysMatch(a: string, b: string, minOverlap = 12): boolean {
  const na = titleKey(a, 64);
  const nb = titleKey(b, 64);
  if (na === nb) return true;
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na];
  return short.length >= minOverlap && long.startsWith(short);
}

/**
 * Append a row at the end of the ledger.
 *
 * The generated headers end with `## Rows`, so end-of-file is under it.
 * Returns the 1-indexed line number written.
 */
export function appendRow(path: string, row: string): number {
  if (!existsSync(path)) die(`ledger not found: ${path}`);
  const lines = readFileSync(path, "utf8").split("\n");
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  lines.push("", row);
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
  return lines.length;
}

export function replaceLine(path: string, lineno: number, next: string): void {
  const lines = readFileSync(path, "utf8").split("\n");
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (lineno < 1 || lineno > lines.length) die(`line ${lineno} out of range for ${path}`);
  lines[lineno - 1] = next;
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

let quietDepth = 0;

/** Run `fn` with emit() silenced: for a command that calls other commands' writers and prints one result of its own. */
export function quietly<T>(fn: () => T): T {
  quietDepth += 1;
  try {
    return fn();
  } finally {
    quietDepth -= 1;
  }
}

export function emit(obj: unknown, asJson: boolean): void {
  if (quietDepth > 0) return;
  if (asJson) {
    console.log(JSON.stringify(obj, null, 2));
    return;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) console.log(typeof item === "object" ? JSON.stringify(item) : String(item));
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (Array.isArray(v)) {
        console.log(`${k}:`);
        for (const item of v) console.log(`  ${typeof item === "object" ? JSON.stringify(item) : String(item)}`);
      } else {
        console.log(`${k}: ${v && typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      }
    }
    return;
  }
  console.log(String(obj));
}

/**
 * Split `argv` at the first token that names a subcommand, so shared flags are
 * accepted on either side of it: `agent.ts --agent x targets` and
 * `agent.ts targets --agent x` both work, as they did under argparse.
 */
export function splitCommand(argv: string[], commands: readonly string[]): { cmd: string; rest: string[] } {
  const i = argv.findIndex((a) => commands.includes(a));
  if (i < 0) die(`expected a command: ${commands.join(", ")}`);
  return { cmd: argv[i], rest: [...argv.slice(0, i), ...argv.slice(i + 1)] };
}

export type Options = NonNullable<ParseArgsConfig["options"]>;

/** parseArgs with a readable error instead of a stack trace. */
export function parse(argv: string[], options: Options): Record<string, string | boolean | undefined> {
  try {
    const { values } = parseArgs({ args: argv, options, allowPositionals: false, strict: true });
    return values as Record<string, string | boolean | undefined>;
  } catch (error) {
    return die(error instanceof Error ? error.message : String(error));
  }
}
