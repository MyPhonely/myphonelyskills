/**
 * Read and write the agent's markdown ledgers. All dedup lives here.
 *
 * Run as `outreach.ts ledger <command>`; the examples below omit that prefix.
 *
 * People ledger (linkedin-outreach.md)
 *     ledger.ts add-lead      --name "Jane Doe" --headline "VP Eng at Acme"
 *     ledger.ts list-people   --stage Lead              # review queue
 *     ledger.ts invite        --name "Jane Doe"         # request sent
 *     ledger.ts check-person  --name "Jane Doe"
 *     ledger.ts add-person    --name "Jane Doe" --note "industry: fintech"
 *     ledger.ts accept        --name "Jane Doe"          # they accepted
 *     ledger.ts list-people   --stage Invited            # still pending
 *     ledger.ts list-people   --stage Connected --no-message   # warmup pool
 *     ledger.ts set-stage     --name "Jane Doe" --stage "Warmup Sent" --touch
 *     ledger.ts list-people   --stage Invited --no-message --older-than 21
 *
 * Post dedup ledger (commented-posts.md)
 *     ledger.ts check-post --platform x --author "@someone" --title "..." [--url "..."]
 *     ledger.ts add-post   --platform x --author "@someone" --title "..." --url "..."
 *     ledger.ts count-posts --platform x-papers [--date YYYY-MM-DD]   # today's, for a budget
 *
 * Human-facing queue (social-outreach-queue.md)
 *     ledger.ts add-queue --status Commented --platform x --keyword "<kw>" \
 *         --author "@someone" --title "..." --url "..." --comment "..."
 *
 * First run for an agent
 *     ledger.ts init        # creates the three ledgers, idempotent
 *
 * Exit status for the `check-*` commands: 0 = found (skip it), 1 = not found
 * (proceed). Free text is sanitized: a literal `|` becomes `/` so a cell can
 * never break the row format.
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  LEDGERS,
  appendRow,
  clean,
  dataRows,
  die,
  emit,
  ensureDir,
  fields,
  keysMatch,
  ledgerPath,
  loadAgent,
  parse,
  replaceLine,
  setCurrentAgent,
  splitCommand,
  stateDir,
  titleKey,
  today,
} from "./common.ts";
import type { LedgerName } from "./common.ts";

/**
 * A person moves down this list, one stage at a time.
 *
 * `Invited` and `Connected` are NOT the same thing and the difference is the
 * whole point of the connect channel: an invitation that has been sent is not
 * an accepted connection, and LinkedIn will not let you message a non-
 * connection at all. Only `Connected` rows are eligible for a warmup.
 */
export const STAGES = [
  "Lead",           // seen on a result card, profile NOT yet opened -- NOT contacted
  "Disqualified",   // profile was opened and they do not fit -- NOT contacted
  "Invited",        // request sent, waiting on them
  "Connected",      // they accepted -- a 1st-degree connection, messageable
  "Warmup Sent",
  "Pitched",
  "Followed Up",
  "Replied",         // they wrote back and we still owe them an answer
  "Answered",        // we responded; the ball is with them again
  "Not Interested",
  "Withdrawn",      // request pulled back unaccepted; never became a contact
] as const;

// Platform spelling drifted over time (xiaohongshu / Xiaohongshu / XHS, X / x),
// so every platform comparison normalizes through this.
const PLATFORM_ALIASES: Record<string, string> = {
  xhs: "xiaohongshu",
  "小红书": "xiaohongshu",
  xiaohongshu: "xiaohongshu",
  x: "x",
  twitter: "x",
  reddit: "reddit",
  linkedin: "linkedin",
  "1p3a": "1point3acres",
  "一亩三分地": "1point3acres",
};

/**
 * One spelling per post URL, so the same post found twice matches: X serves
 * the same status as twitter.com and x.com, with or without `?s=20` share
 * junk, a trailing slash or a `/photo/1` suffix.
 */
export function postUrlKey(raw: string): string {
  let u = raw.trim().toLowerCase();
  if (!u) return "";
  u = u.replace(/^https?:\/\//, "").replace(/^(www\.|mobile\.)/, "");
  u = u.replace(/[?#].*$/, "").replace(/\/+$/, "");
  u = u.replace(/^twitter\.com\//, "x.com/");
  // x.com/<handle>/status/<id>/photo/1 -> the status itself; the handle can
  // change, the id cannot.
  const status = u.match(/^x\.com\/[^/]+\/status\/(\d+)/);
  if (status) return `x.com/status/${status[1]}`;
  return u;
}

export function normPlatform(p: string): string {
  const key = p.trim().toLowerCase();
  if (PLATFORM_ALIASES[key]) return PLATFORM_ALIASES[key];
  // A stream of one platform is that platform: `x-papers` and `x` share one
  // dedup history, so a post found by both is still commented once.
  const stream = key.match(/^([^-]+)-./);
  if (stream && PLATFORM_ALIASES[stream[1]]) return PLATFORM_ALIASES[stream[1]];
  return key;
}

/**
 * Column order of a people-ledger row. Always index through this, never with a
 * bare number -- the row has grown twice and hand-counted offsets silently
 * wrote the right value into the wrong cell.
 */
const COL = {
  stage: 0,
  name: 1,
  headline: 2,
  url: 3,
  invited: 4,   // invited_on -- empty for a Lead
  accepted: 5,  // accepted_on -- empty until they accept
  message: 6,   // last_message
  notes: 7,
} as const;
const WIDTH = Object.keys(COL).length;

export const PEOPLE_COLUMNS = "stage | name | headline | profile_url | invited_on | accepted_on | last_message | notes";

/**
 * Strip the decorations LinkedIn glues onto a name in the accessibility tree.
 *
 * A result card reads `Jane Doe Verified • 3rd+`, and that whole string can
 * arrive as the name. Every phase after discovery joins on this value, so a
 * decorated name would simply never match again -- silently, with no error.
 * Applied on both write and lookup, so the two always agree.
 */
export function personName(raw: string): string {
  return raw
    // A Reactions sheet row reads `Jane Doe reacted with Like, ...`.
    .replace(/\s+reacted\s+with\b.*$/i, "")
    // A comment row can read `Jane Doe commented ...`.
    .replace(/\s+commented\b.*$/i, "")
    .replace(/\s*[•·|]\s*\d+(st|nd|rd|th)\+?\s*$/i, "")
    .replace(/\s*\b\d+(st|nd|rd|th)\+\s*$/i, "")
    .replace(/\s*\bVerified\b\s*/gi, " ")
    .replace(/\s*[•·]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pad a parsed row out to the full width so every column is addressable. */
function pad(f: string[]): string[] {
  while (f.length < WIDTH) f.push("");
  return f;
}

export function findPeople(name: string): Array<[number, string[]]> {
  const needle = personName(name).toLocaleLowerCase();
  const hits: Array<[number, string[]]> = [];
  for (const [lineno, row] of dataRows(ledgerPath("people"))) {
    const f = fields(row);
    if (f.length >= 2 && personName(f[COL.name]).toLocaleLowerCase() === needle) hits.push([lineno, pad(f)]);
  }
  return hits;
}

export type Values = Record<string, string | boolean | undefined>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function checkPerson(v: Values, json: boolean): number {
  const hits = findPeople(str(v.name));
  emit({ name: v.name, found: hits.length > 0, rows: hits.map(([n, f]) => `L${n}: ${f.join(" | ")}`) }, json);
  return hits.length ? 0 : 1;
}

/** Write a new row at `stage`, refusing a name the ledger already holds. */
function addRow(v: Values, json: boolean, stage: string, invitedOn: string): number {
  if (findPeople(str(v.name)).length) {
    emit({ name: v.name, added: false, reason: "already in ledger" }, json);
    return 1;
  }
  if (!STAGES.includes(stage as (typeof STAGES)[number])) {
    emit({ added: false, reason: `stage must be one of ${STAGES.join(", ")}` }, json);
    return 2;
  }
  const f = pad([]);
  f[COL.stage] = stage;
  f[COL.name] = clean(personName(str(v.name)));
  f[COL.headline] = clean(str(v.headline));
  f[COL.url] = clean(str(v.url));
  f[COL.invited] = invitedOn;
  f[COL.accepted] = clean(str(v["accepted-on"]));
  f[COL.message] = clean(str(v["last-message"]));
  f[COL.notes] = clean(str(v.note));
  const row = f.join(" | ");
  const n = appendRow(ledgerPath("people"), row);
  emit({ name: v.name, added: true, stage, line: n, row }, json);
  return 0;
}

/**
 * Record someone discovery found. A Lead has no invited_on: nothing has been
 * sent to them yet, so they must not count against the invite quota.
 */
function addLead(v: Values, json: boolean): number {
  return addRow(v, json, "Lead", "");
}

/**
 * Stages that mean nothing was ever sent to this person. They carry no
 * invited_on, so the invite quota never counts them -- which is what lets the
 * ledger cache an expensive "checked, does not fit" verdict for free.
 */
const UNCONTACTED = new Set(["Lead", "Disqualified"]);

/** Record a person at a given stage; Invited unless told otherwise. */
export function addPerson(v: Values, json: boolean): number {
  const stage = str(v.stage) || "Invited";
  const invitedOn = UNCONTACTED.has(stage) ? "" : str(v.date) || today();
  return addRow(v, json, stage, invitedOn);
}

export function setStage(v: Values, json: boolean): number {
  const hits = findPeople(str(v.name));
  if (!hits.length) {
    emit({ name: v.name, updated: false, reason: "not in ledger" }, json);
    return 1;
  }
  const [lineno, f] = hits[hits.length - 1];
  if (v.stage) {
    if (!STAGES.includes(str(v.stage) as (typeof STAGES)[number])) {
      emit({ updated: false, reason: `stage must be one of ${STAGES.join(", ")}` }, json);
      return 2;
    }
    f[COL.stage] = str(v.stage);
  }
  if (v.headline) f[COL.headline] = clean(str(v.headline));
  if (v.url) f[COL.url] = clean(str(v.url));
  if (v["invited-on"]) f[COL.invited] = str(v["invited-on"]);
  if (v["accepted-on"]) f[COL.accepted] = str(v["accepted-on"]);
  if (v.touch || v["last-message"]) f[COL.message] = str(v["last-message"]) || today();
  if (v.note) f[COL.notes] = (f[COL.notes] ? `${f[COL.notes]} - ` : "") + clean(str(v.note));
  const row = f.join(" | ");
  replaceLine(ledgerPath("people"), lineno, row);
  emit({ name: v.name, updated: true, line: lineno, row }, json);
  return 0;
}

/** Move one row forward a stage, stamping its date. Shared by invite/accept. */
function promote(
  v: Values,
  json: boolean,
  opts: { from: string; to: string; dateCol: number; dateFlag: string; verb: string },
): number {
  const hits = findPeople(str(v.name));
  if (!hits.length) {
    emit({ name: v.name, [opts.verb]: false, reason: `not in ledger -- this pipeline never had them as a ${opts.from}` }, json);
    return 1;
  }
  const [lineno, f] = hits[hits.length - 1];
  if (f[COL.stage] !== opts.from) {
    emit({ name: v.name, [opts.verb]: false, stage: f[COL.stage], reason: `already past ${opts.from} (${f[COL.stage]})` }, json);
    return 0;
  }
  f[COL.stage] = opts.to;
  f[opts.dateCol] = str(v[opts.dateFlag]) || today();
  if (v.url && !f[COL.url]) f[COL.url] = clean(str(v.url));
  if (v.note) f[COL.notes] = (f[COL.notes] ? `${f[COL.notes]} - ` : "") + clean(str(v.note));
  const row = f.join(" | ");
  replaceLine(ledgerPath("people"), lineno, row);
  emit({ name: v.name, [opts.verb]: true, line: lineno, date: f[opts.dateCol], row }, json);
  return 0;
}

/**
 * A reviewed lead has had its request sent. Stamps invited_on, which is what
 * the quota and the stale-withdraw window both measure from.
 */
export function invitePerson(v: Values, json: boolean): number {
  return promote(v, json, { from: "Lead", to: "Invited", dateCol: COL.invited, dateFlag: "invited-on", verb: "invited" });
}

/**
 * Promote a pending invite to an accepted connection.
 *
 * Exit 1 when the name is not in the ledger at all: the connections list on
 * the phone contains people this pipeline never invited, and silently adding
 * them would put strangers into the warmup pool. Exit 0 for an already-
 * accepted row so a re-run of the harvest is a no-op rather than an error.
 */
function acceptPerson(v: Values, json: boolean): number {
  return promote(v, json, { from: "Invited", to: "Connected", dateCol: COL.accepted, dateFlag: "accepted-on", verb: "accepted" });
}

function listPeople(v: Values, json: boolean): number {
  let cutoff: Date | null = null;
  if (v["older-than"] !== undefined) {
    cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - Number(v["older-than"]));
  }
  const out: Array<Record<string, unknown>> = [];
  for (const [lineno, row] of dataRows(ledgerPath("people"))) {
    const f = pad(fields(row));
    if (v.stage && f[COL.stage] !== v.stage) continue;
    if (v["no-message"] && f[COL.message]) continue;
    if (cutoff) {
      // --older-than measures from the invite, which is what decides whether a
      // pending request is stale enough to withdraw.
      const when = new Date(`${f[COL.invited]}T00:00:00`);
      if (Number.isNaN(when.getTime()) || when > cutoff) continue;
    }
    out.push({
      line: lineno,
      stage: f[COL.stage],
      name: f[COL.name],
      headline: f[COL.headline],
      url: f[COL.url],
      invited_on: f[COL.invited],
      accepted_on: f[COL.accepted],
      last_message: f[COL.message],
    });
  }
  if (json) {
    emit(out, true);
  } else {
    for (const r of out) console.log(`L${r.line}\t${r.stage}\t${r.invited_on || "-"}\t${r.name}\t${r.headline}`);
    console.log(`-- ${out.length} row(s)`);
  }
  return 0;
}

/**
 * Ledger rows for a post already commented on. On platforms with no titles
 * (X), the "title" is the first words of the post, and two reads of it can
 * differ. The URL cannot, so a URL match is a hit on its own.
 */
export function findPosts(platform: string, author: string, title: string, url = ""): string[] {
  const plat = normPlatform(platform);
  const who = author.trim().toLocaleLowerCase();
  const key = titleKey(title);
  const want = postUrlKey(url);
  const hits: string[] = [];
  for (const [lineno, row] of dataRows(ledgerPath("dedup"))) {
    const f = fields(row);
    if (f.length < 4) continue;
    if (normPlatform(f[1]) !== plat) continue;
    const sameUrl = want !== "" && f.length > 5 && postUrlKey(f[5]) === want;
    if (sameUrl || (f[2].trim().toLocaleLowerCase() === who && keysMatch(f[3], key))) {
      hits.push(`L${lineno}: ${f.slice(0, 5).join(" | ")}`);
    }
  }
  return hits;
}

function checkPost(v: Values, json: boolean): number {
  const hits = findPosts(str(v.platform), str(v.author), str(v.title), str(v.url));
  emit({ platform: normPlatform(str(v.platform)), author: v.author, title_key: titleKey(str(v.title)), already_commented: hits.length > 0, rows: hits }, json);
  return hits.length ? 0 : 1;
}

/**
 * Posts commented on one day under one channel name, for a daily budget.
 * Matched on the channel as written, not normalized: `x` and `x-papers`
 * share a dedup history but each has its own ceiling.
 */
export function countPosts(platform: string, day: string, rows: Iterable<[number, string]>): number {
  const want = platform.trim().toLowerCase();
  let n = 0;
  for (const [, row] of rows) {
    const f = fields(row);
    if (f.length >= 2 && f[0].trim() === day && f[1].trim().toLowerCase() === want) n += 1;
  }
  return n;
}

export function addPost(v: Values, json: boolean): number {
  const key = titleKey(str(v.title));
  const row = [str(v.date) || today(), clean(str(v.platform)), clean(str(v.author)), key, clean(str(v.title)), clean(str(v.url))].join(" | ");
  const n = appendRow(ledgerPath("dedup"), row);
  emit({ added: true, line: n, title_key: key, row }, json);
  return 0;
}

export const QUEUE_STATUS = ["Pending Review", "Approved", "Commented", "Skipped"];

/** Queue columns: status | platform | keyword | author | title | post_url | date_found | snippet | suggested_comment | notes */
export const Q = { status: 0, platform: 1, keyword: 2, author: 3, title: 4, url: 5, date: 6, snippet: 7, comment: 8, notes: 9 } as const;

export interface QueueRow {
  line: number;
  status: string;
  platform: string;
  keyword: string;
  author: string;
  title: string;
  url: string;
  date: string;
  comment: string;
  notes: string;
}

export function queueRows(): QueueRow[] {
  return dataRows(ledgerPath("queue")).map(([line, row]) => {
    const f = fields(row);
    while (f.length < 10) f.push("");
    return {
      line,
      status: f[Q.status],
      platform: f[Q.platform],
      keyword: f[Q.keyword],
      author: f[Q.author],
      title: f[Q.title],
      url: f[Q.url],
      date: f[Q.date],
      comment: f[Q.comment],
      notes: f[Q.notes],
    };
  });
}

/** Queue rows for this post that are still waiting: a draft to review, or one approved and not yet sent. */
export function openQueueRows(platform: string, author: string, title: string, url = ""): QueueRow[] {
  const plat = normPlatform(platform);
  const want = postUrlKey(url);
  const who = author.trim().toLocaleLowerCase();
  return queueRows().filter(
    (r) =>
      (r.status === "Pending Review" || r.status === "Approved") &&
      normPlatform(r.platform) === plat &&
      ((want !== "" && postUrlKey(r.url) === want) || (r.author.trim().toLocaleLowerCase() === who && keysMatch(titleKey(r.title), titleKey(title)))),
  );
}

/** Change a queue row's status, and optionally its comment, in place. */
export function updateQueueRow(line: number, status: string, comment?: string, note?: string): string {
  if (!QUEUE_STATUS.includes(status)) return die(`status must be one of: ${QUEUE_STATUS.join(", ")}`);
  const row = queueRows().find((r) => r.line === line);
  if (!row) return die(`no queue row at line ${line}`);
  const f = fields(dataRows(ledgerPath("queue")).find(([n]) => n === line)?.[1] ?? "");
  while (f.length < 10) f.push("");
  f[Q.status] = status;
  if (comment !== undefined) f[Q.comment] = clean(comment);
  if (note) f[Q.notes] = (f[Q.notes] ? `${f[Q.notes]} - ` : "") + clean(note);
  const next = f.join(" | ");
  replaceLine(ledgerPath("queue"), line, next);
  return next;
}

export function addQueue(v: Values, json: boolean): number {
  const status = str(v.status);
  if (!QUEUE_STATUS.includes(status)) return die(`--status must be one of: ${QUEUE_STATUS.join(", ")}`);
  const row = [
    status,
    clean(str(v.platform)),
    clean(str(v.keyword)),
    clean(str(v.author)),
    clean(str(v.title)),
    clean(str(v.url)),
    str(v.date) || today(),
    clean(str(v.snippet)),
    clean(str(v.comment)),
    clean(str(v.note)),
  ].join(" | ");
  const n = appendRow(ledgerPath("queue"), row);
  emit({ added: true, line: n, row }, json);
  return 0;
}

const HEADERS: Record<LedgerName, string> = {
  people: `# People Outreach Ledger

Pipe-delimited, one person per row, newest appended at the bottom.
Row format below; free text must never contain a literal pipe (use \`/\`).

\`\`\`
stage | name | headline | profile_url | invited_on | accepted_on | last_message | notes
\`\`\`

stage is one of: {stages}

A Lead has been discovered but NOT contacted -- it has no invited_on and does
not count against the invite quota. invited_on is the date the request was sent; accepted_on is the date they
accepted and stays empty until they do. Only a row with a stage at or past
Connected has ever been messageable.

## Rows
`,
  dedup: `# Commented-Posts Ledger (dedup source of truth)

Append-only log of every post commented on, used to prevent double-commenting
the same real-world post. Share URLs rotate, so this keys on a stable identity.

Key is platform + author + title-key, where title-key is the post title
lowercased with non-word characters stripped, first 24 chars.

\`\`\`
date | platform | author | title-key | full-title | post-url
\`\`\`

## Rows
`,
  queue: `# Social Outreach Queue

Human-facing log of what was posted. Pipe-delimited, newest at the bottom.

\`\`\`
status | platform | keyword | author | title | post_url | date_found | snippet | suggested_comment | notes
\`\`\`

status is one of: Pending Review, Approved, Commented, Skipped

## Rows
`,
};

/** Create this product's three ledgers. Never touches an existing file. */
export function init(json: boolean): number {
  const dir = stateDir();
  ensureDir(dir);
  const made: string[] = [];
  const kept: string[] = [];
  for (const [which, name] of Object.entries(LEDGERS) as Array<[LedgerName, string]>) {
    const p = join(dir, name);
    if (existsSync(p)) {
      kept.push(name);
      continue;
    }
    writeFileSync(p, HEADERS[which].replace("{stages}", STAGES.join(", ")), "utf8");
    made.push(name);
  }
  emit({ records: dir, created: made, already_present: kept }, json);
  return 0;
}

const COMMANDS = [
  "check-person",
  "add-lead",
  "add-person",
  "invite",
  "accept",
  "set-stage",
  "list-people",
  "check-post",
  "add-post",
  "count-posts",
  "add-queue",
  "title-key",
  "init",
] as const;

export function main(argv: string[]): number {
  const { cmd, rest } = splitCommand(argv, COMMANDS);
  const v = parse(rest, {
    json: { type: "boolean", default: false },
    agent: { type: "string" },
    name: { type: "string" },
    stage: { type: "string" },
    url: { type: "string" },
    date: { type: "string" },
    "last-message": { type: "string" },
    "accepted-on": { type: "string" },
    "invited-on": { type: "string" },
    headline: { type: "string" },
    note: { type: "string" },
    touch: { type: "boolean", default: false },
    "no-message": { type: "boolean", default: false },
    "older-than": { type: "string" },
    platform: { type: "string" },
    author: { type: "string" },
    title: { type: "string" },
    status: { type: "string" },
    keyword: { type: "string" },
    snippet: { type: "string" },
    comment: { type: "string" },
  });
  const json = Boolean(v.json);

  // Resolve the agent's own records. $OUTREACH_STATE still wins; without it,
  // agent.yaml's `records:` decides, so two agents never share a ledger.
  setCurrentAgent(process.env.OUTREACH_STATE && !v.agent && !process.env.OUTREACH_AGENT ? null : loadAgent(v.agent as string | undefined));

  const need = (flag: string): void => {
    if (!v[flag]) die(`${cmd} needs --${flag}`);
  };

  switch (cmd) {
    case "check-person":
      need("name");
      return checkPerson(v, json);
    case "add-lead":
      need("name");
      return addLead(v, json);
    case "add-person":
      need("name");
      return addPerson(v, json);
    case "invite":
      need("name");
      return invitePerson(v, json);
    case "accept":
      need("name");
      return acceptPerson(v, json);
    case "set-stage":
      need("name");
      return setStage(v, json);
    case "list-people":
      return listPeople(v, json);
    case "check-post":
      need("platform"); need("author"); need("title");
      return checkPost(v, json);
    case "add-post":
      need("platform"); need("author"); need("title");
      return addPost(v, json);
    case "count-posts": {
      need("platform");
      const day = str(v.date) || today();
      const count = countPosts(str(v.platform), day, dataRows(ledgerPath("dedup")));
      emit({ platform: str(v.platform), date: day, count }, json);
      return 0;
    }
    case "add-queue":
      need("status"); need("platform"); need("author"); need("title");
      return addQueue(v, json);
    case "title-key":
      need("title");
      console.log(titleKey(str(v.title)));
      return 0;
    default:
      return init(json);
  }
}

