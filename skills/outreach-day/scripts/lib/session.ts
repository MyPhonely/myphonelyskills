/**
 * The rules around every write, as commands any agent can run.
 *
 *   outreach.ts check   --channel x --author @a --title "first words" [--url ...]
 *   outreach.ts budget  --channel x [--action comment]
 *   outreach.ts reserve --channel x --author @a --title "..." --url ...
 *   outreach.ts record  --reservation r3 --outcome sent --author @a --title "..." --comment "..."
 *   outreach.ts release --reservation r3          # reserved, but nothing was written
 *   outreach.ts report                            # today, per channel
 *
 * A write may only follow a reservation, and `reserve` is where the rules
 * live: it refuses a target the records already have, a target already tried
 * today (sent, failed or untouched), and a channel whose budget is spent.
 * Reservations are kept in <records>/reservations/<date>.json, so they hold
 * across separate shell calls, separate agents and a crashed run alike.
 *
 * A person is a `--name`; a post is `--author` and `--title` (its first words
 * when it has no title), with `--url` whenever there is one.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { dataRows, die, ensureDir, ledgerPath, quietly, stateDir, today } from "./common.ts";
import type { Agent } from "./common.ts";
import { addPerson, addPost, addQueue, countPosts, findPeople, findPosts, invitePerson, openQueueRows, queueRows, setStage, updateQueueRow } from "./ledger.ts";
import type { QueueRow } from "./ledger.ts";
import { commentTargets, resolveChannel } from "./plan.ts";
import { targetKey } from "./policy.ts";
import type { Target } from "./policy.ts";
import { inviteRoom } from "./quota.ts";

export type Action = "invite" | "message" | "comment";

export interface Reservation {
  id: string;
  channel: string;
  action: Action;
  /** targetKey(), for refusing a second attempt at the same target. */
  key: string;
  label: string;
  /** open: reserved, not yet written. spent: a guarded write has used it. */
  state: "open" | "spent" | "sent" | "failed" | "released";
  at: string;
}

interface Day {
  date: string;
  next: number;
  items: Reservation[];
}

function dayPath(date = today()): string {
  return join(stateDir(), "reservations", `${date}.json`);
}

export function loadDay(date = today()): Day {
  const p = dayPath(date);
  if (!existsSync(p)) return { date, next: 1, items: [] };
  return JSON.parse(readFileSync(p, "utf8")) as Day;
}

export function saveDay(day: Day): void {
  const p = dayPath(day.date);
  ensureDir(join(stateDir(), "reservations"));
  writeFileSync(p, JSON.stringify(day, null, 2) + "\n", "utf8");
}

/** Reserved and not yet settled: counts against the budget until recorded or released. */
const PENDING = new Set(["open", "spent"]);

export function kindOf(agent: Agent, channel: string): "connect" | "comment" {
  return (agent.channels[channel]?.kind ?? "comment") === "connect" ? "connect" : "comment";
}

export function actionFor(agent: Agent, channel: string, action?: string): Action {
  const kind = kindOf(agent, channel);
  const a = (action || (kind === "connect" ? "invite" : "comment")) as Action;
  const allowed: Action[] = kind === "connect" ? ["invite", "message"] : ["comment"];
  if (!allowed.includes(a)) die(`${channel} is a ${kind} channel: --action must be ${allowed.join(" or ")}`);
  return a;
}

export interface Budget {
  channel: string;
  action: Action;
  limit: number;
  done: number;
  pending: number;
  left: number;
  note: string;
}

/** Today's limit for one action on one channel, what is done, and what is reserved. */
export function budget(agent: Agent, channel: string, action: Action, day = loadDay()): Budget {
  const ch = agent.channels[channel] ?? {};
  let limit: number;
  let done: number;
  let note: string;
  if (action === "invite") {
    // inviteRoom already subtracts today's and this week's sends.
    const r = inviteRoom(agent);
    limit = r.allowedToday;
    done = 0;
    note = `week ${r.sent}/${r.cap}, today ${r.sentToday}/${r.perDay}${r.cappedBy ? `, capped by the ${r.cappedBy}` : ""}`;
  } else if (action === "message") {
    limit = Number(ch.warmups_per_day ?? 10);
    done = day.items.filter((r) => r.channel === channel && r.action === "message" && r.state === "sent").length;
    note = `warmups_per_day ${limit}, ${done} sent today`;
  } else {
    const plan = commentTargets(agent, channel, new Date());
    const dispatches = (plan.dispatches as Array<{ posts?: number }> | undefined) ?? [];
    limit = ch.comments_per_day !== undefined ? Number(ch.comments_per_day) : dispatches.reduce((n, d) => n + (d.posts ?? 0), 0);
    done = countPosts(channel, today(), dataRows(ledgerPath("dedup")));
    note = `comments_per_day ${limit}, ${done} recorded today`;
  }
  const pending = day.items.filter((r) => r.channel === channel && r.action === action && PENDING.has(r.state)).length;
  return { channel, action, limit, done, pending, left: Math.max(0, limit - done - pending), note };
}

/** Whether the records already have this person or post, and the rows that say so. */
export function check(agent: Agent, channel: string, action: Action, t: Target): { found: boolean; blocking: boolean; rows: string[] } {
  if (t.name) {
    const rows = findPeople(t.name).map(([n, f]) => `L${n}: ${f.join(" | ")}`);
    // A Lead was found but never contacted, so it may still be invited. Any
    // other stage means a request or a message already went out (or the
    // profile was rejected), so a second invite is refused. Messages go to
    // people the records have; they are bounded by the day's attempts instead.
    const stages = findPeople(t.name).map(([, f]) => f[0]);
    const blocking = action === "invite" && stages.some((s) => s !== "Lead");
    return { found: rows.length > 0, blocking, rows };
  }
  if (!t.author || !t.title) die("a target is --name (a person) or --author and --title (a post), with --url when you have it");
  const rows = findPosts(channel, t.author, t.title, t.url ?? "");
  return { found: rows.length > 0, blocking: rows.length > 0, rows };
}

function label(t: Target): string {
  return t.name ?? t.url ?? `${t.author}: ${t.title}`;
}

/** Permission for one write. Throws (refuses) when a rule says no. */
export function reserve(agent: Agent, channelArg: string, actionArg: string | undefined, t: Target): { reservation: Reservation; left: number } {
  const channel = resolveChannel(agent, channelArg);
  const action = actionFor(agent, channel, actionArg);
  const key = `${action}:${targetKey(t)}`;
  const day = loadDay();
  const prior = day.items.find((r) => r.channel === channel && r.key === key && r.state !== "released");
  if (prior) {
    die(
      `refused: ${label(t)} was already reserved today (${prior.id}, ${prior.state}). One attempt per target per day; ` +
        "a failed one is retried on a later day. Move on.",
      3,
    );
  }
  const seen = check(agent, channel, action, t);
  if (seen.blocking) die(`refused: the records already have ${label(t)}; skip it.\n${seen.rows.join("\n")}`, 3);
  const b = budget(agent, channel, action, day);
  if (b.left <= 0) die(`refused: no ${action} budget left on ${channel} today (${b.note}). Stop this channel.`, 4);
  const r: Reservation = { id: `r${day.next++}`, channel, action, key, label: label(t), state: "open", at: new Date().toISOString() };
  day.items.push(r);
  saveDay(day);
  return { reservation: r, left: b.left - 1 };
}

function find(day: Day, id: string): Reservation {
  const r = day.items.find((x) => x.id === id);
  if (!r) return die(`no reservation ${id} today; reserve before writing`);
  if (!PENDING.has(r.state)) return die(`${id} is already settled (${r.state})`);
  return r;
}

export interface RecordInput {
  reservation: string;
  outcome: string;
  target: Target;
  comment?: string;
  keyword?: string;
  note?: string;
}

/**
 * Settle a reservation and write the ledgers. `sent` only for a write that was
 * verified on screen; anything else is `failed`, which keeps the draft in the
 * queue for a later day.
 */
export function record(agent: Agent, input: RecordInput): Reservation {
  return quietly(() => recordQuietly(agent, input));
}

function recordQuietly(agent: Agent, input: RecordInput): Reservation {
  if (input.outcome !== "sent" && input.outcome !== "failed") die("--outcome must be sent or failed");
  const day = loadDay();
  const r = find(day, input.reservation);
  const t = input.target;
  const json = true;
  if (r.action === "invite" || r.action === "message") {
    if (!t.name) die("a person needs --name");
    if (input.outcome === "sent" && r.action === "invite") {
      // A Lead becomes Invited; someone found without a Lead row is added as Invited.
      if (invitePerson({ name: t.name, url: t.url, note: input.note }, json) !== 0) {
        addPerson({ name: t.name, url: t.url, note: input.note ?? "invited" }, json);
      }
    } else if (input.outcome === "sent") {
      setStage({ name: t.name, stage: input.note === "answer" ? "Answered" : "Warmup Sent", touch: true }, json);
    }
  } else {
    if (!t.author || !t.title) die("a post needs --author and --title");
    const common = { platform: r.channel, author: t.author, title: t.title, url: t.url };
    if (input.outcome === "sent") addPost(common, json);
    // A draft already queued for this post is settled in place: sent becomes
    // Commented; a failed one keeps its status for a later day.
    const queued = openQueueRows(r.channel, t.author, t.title, t.url ?? "");
    if (queued.length) {
      const q = queued[queued.length - 1];
      updateQueueRow(q.line, input.outcome === "sent" ? "Commented" : q.status, input.comment, input.note);
    } else {
      addQueue(
        { ...common, status: input.outcome === "sent" ? "Commented" : "Approved", keyword: input.keyword, comment: input.comment, note: input.note },
        json,
      );
    }
  }
  r.state = input.outcome;
  saveDay(day);
  return r;
}

/**
 * Queue a comment for the user to review instead of posting it: the review
 * mode of a run no one is watching. Refused when the records already have the
 * post or a draft for it is already waiting. Takes no reservation and no budget.
 */
export function draft(agent: Agent, channelArg: string, t: Target, comment: string, keyword?: string): QueueRow {
  const channel = resolveChannel(agent, channelArg);
  if (kindOf(agent, channel) !== "comment") die(`${channel} is not a comment channel; drafts are comments`);
  if (!t.author || !t.title) die("a post needs --author and --title (and --url when there is one)");
  if (!comment.trim()) die("draft needs --comment");
  const done = findPosts(channel, t.author, t.title, t.url ?? "");
  if (done.length) die(`refused: the records already have this post; skip it.\n${done.join("\n")}`, 3);
  const waiting = openQueueRows(channel, t.author, t.title, t.url ?? "");
  if (waiting.length) die(`refused: a draft for this post is already waiting (line ${waiting[0].line}, ${waiting[0].status})`, 3);
  quietly(() => addQueue({ status: "Pending Review", platform: channel, author: t.author, title: t.title, url: t.url, keyword, comment, note: "draft" }, false));
  return queueRows().at(-1) as QueueRow;
}

/** Drafts waiting, oldest first: Pending Review (for the user) or Approved (to post). */
export function drafts(agent: Agent, status?: string, channel?: string): QueueRow[] {
  const want = channel ? resolveChannel(agent, channel) : null;
  return queueRows().filter(
    (r) => (status ? r.status === status : r.status === "Pending Review" || r.status === "Approved") && (!want || r.platform === want),
  );
}

/** The user's verdict on a draft: Approved (optionally with an edited comment) or Skipped. */
export function mark(line: number, status: string, comment?: string): QueueRow {
  if (status !== "Approved" && status !== "Skipped") die("--status must be Approved or Skipped");
  const row = queueRows().find((r) => r.line === line);
  if (!row) return die(`no queue row at line ${line}`);
  if (row.status !== "Pending Review" && row.status !== "Approved") die(`line ${line} is ${row.status}, not a draft`);
  updateQueueRow(line, status, comment);
  return queueRows().find((r) => r.line === line) as QueueRow;
}

/** Give a reservation back when nothing was written: it no longer holds the budget or the target. */
export function release(id: string): Reservation {
  const day = loadDay();
  const r = find(day, id);
  r.state = "released";
  saveDay(day);
  return r;
}

/** Today per channel: reserved, sent, failed, still open, and the budget left. */
export function report(agent: Agent, date = today()): Array<Record<string, unknown>> {
  const day = loadDay(date);
  const channels = agent.order ?? Object.keys(agent.channels);
  const out: Array<Record<string, unknown>> = [];
  for (const channel of channels) {
    const actions: Action[] = kindOf(agent, channel) === "connect" ? ["invite", "message"] : ["comment"];
    for (const action of actions) {
      const mine = day.items.filter((r) => r.channel === channel && r.action === action);
      const count = (s: string) => mine.filter((r) => r.state === s).length;
      const b = date === today() ? budget(agent, channel, action, day) : null;
      out.push({
        channel,
        action,
        sent: count("sent"),
        failed: count("failed"),
        unsettled: mine.filter((r) => PENDING.has(r.state)).map((r) => `${r.id} ${r.label}`),
        left: b ? b.left : "-",
        limit: b ? b.note : "-",
      });
    }
  }
  return out;
}

