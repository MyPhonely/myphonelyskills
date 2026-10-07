/**
 * What the pi outreach agent may do on the phone, decided by code.
 *
 * The agent decides which move to make; this decides whether a move that
 * could write is allowed. Pure — no pi, no phone — so it is tested on its own
 * (test/pi-policy.test.ts) and the extension (outreach.ts) only wires it up.
 *
 * The rules:
 *
 *   1. Writes go through run_task, never through Mode 2. Direct calls that
 *      can write (typing, coordinate taps, long presses, swipes, files) are
 *      refused, and so is a label tap on a write-looking control.
 *   2. A planned run (`request`) may not write: its phases are not known in
 *      advance, so nothing can be checked against them.
 *   3. A writing phase pauses for review (`pauseWhen`) unless the person
 *      chose unattended runs.
 *   4. Every write spends a reservation. A reservation exists only after the
 *      ledger said "not done before" and the channel's budget had room, so
 *      the agent cannot write past a budget or skip the duplicate check.
 *   5. The commit itself — resume_task with writes on — is approved by the
 *      person unless runs are unattended.
 *   6. One target, one attempt per session. A second reservation for a
 *      person or post already reserved is refused, whether the first write
 *      was sent, failed or never made: a failed write is retried by a later
 *      run, never in a loop within this one.
 */

/** The MyPhonely MCP server's name as the extension registers it. */
export const SERVER = "myphonely";

/** Direct (Mode 2) calls that can change something in an app. */
export const WRITING_DIRECT = new Set([
  "phone_type",
  "phone_clear_text",
  "phone_tap",
  "phone_long_press",
  "phone_swipe",
  "phone_push_file",
  "phone_pull_file",
]);

/** A label that commits something when tapped. */
export const WRITE_LABEL =
  /\b(post|reply|send|connect|invite|follow|like|repost|retweet|comment|message|withdraw|accept|ignore|share|publish|submit|tweet|save|delete|remove|block|report|join|unfollow|subscribe)\b/i;

/** `mcp__myphonely__run_task` -> `run_task`; null for any other tool. */
export function phoneTool(toolName: string): string | null {
  const prefix = `mcp__${SERVER}__`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : null;
}

export interface Phase {
  goal?: string;
  allowWrites?: boolean;
  pauseWhen?: string;
  repeat?: number;
  typeTexts?: string[];
}

export type Decision =
  | { kind: "read" }
  | { kind: "blocked"; reason: string }
  /** `count` writes, each spending a reservation; `approve` when the person must see it now. */
  | { kind: "write"; count: number; approve: string | null; taskId?: string };

export interface Context {
  /** The person chose unattended runs: no review pauses or approvals required. */
  unattended: boolean;
  /** run_task task ids whose writes already spent reservations. */
  ticketedTasks: ReadonlySet<string>;
}

export function decide(toolName: string, input: Record<string, unknown>, ctx: Context): Decision {
  const tool = phoneTool(toolName);
  if (!tool) return { kind: "read" };

  if (WRITING_DIRECT.has(tool)) {
    return { kind: "blocked", reason: `${tool} can write on the phone; writes go through run_task with a review pause` };
  }
  if (tool === "phone_tap_label") {
    const label = String(input.text ?? "");
    if (WRITE_LABEL.test(label)) {
      return { kind: "blocked", reason: `tapping '${label}' would commit something; do it in a run_task writing phase instead` };
    }
    return { kind: "read" };
  }

  if (tool === "run_task" || tool === "phone_task") {
    if (input.allow_writes !== true) return { kind: "read" };
    if (typeof input.request === "string" && input.request.trim()) {
      return { kind: "blocked", reason: "a planned run (request) may not write; give explicit phases" };
    }
    const phases = (Array.isArray(input.phases) ? input.phases : []) as Phase[];
    const writing = phases.filter((p) => p && p.allowWrites === true);
    if (!writing.length) return { kind: "read" };
    if (!ctx.unattended) {
      const unpaused = writing.find((p) => !p.pauseWhen);
      if (unpaused) {
        return { kind: "blocked", reason: "a writing phase needs pauseWhen, so the write stops for review before it is made" };
      }
    }
    const count = writing.reduce((n, p) => n + Math.max(1, Number(p.repeat) || 1), 0);
    // With a pause, the commit is the resume: approval is asked then.
    return { kind: "write", count, approve: null };
  }

  if (tool === "resume_task") {
    if (input.abandon === true) return { kind: "read" };
    const taskId = String(input.task_id ?? "");
    const ticketed = ctx.ticketedTasks.has(taskId);
    if (input.allowWrites !== true && !ticketed) return { kind: "read" };
    const text = typeof input.text === "string" ? input.text : "";
    const what = [
      text ? `text: ${text}` : "",
      input.repeat ? `up to ${String(input.repeat)} write(s)` : "",
      input.goal ? `goal: ${String(input.goal)}` : "",
    ].filter(Boolean).join("\n");
    return {
      kind: "write",
      count: ticketed ? 0 : Math.max(1, Number(input.repeat) || 1),
      approve: ctx.unattended ? null : what || "continue the paused write",
      taskId,
    };
  }

  return { kind: "read" };
}

/** What a write is aimed at, as given to the tools. */
export interface Target {
  name?: string;
  author?: string;
  title?: string;
  url?: string;
}

/**
 * One spelling per target, so the same person or post reserved twice is
 * recognised: a person by name, a post by URL when there is one, else by
 * author and its first words. Case and spacing do not matter.
 */
export function targetKey(t: Target): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  if (t.name) return `person:${norm(t.name)}`;
  if (t.url) return `url:${norm(t.url).replace(/^https?:\/\/(www\.|mobile\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "")}`;
  return `post:${norm(t.author ?? "")}|${norm(t.title ?? "").slice(0, 60)}`;
}

export interface Reservation {
  id: string;
  channel: string;
  /** targetKey(), for refusing a second attempt at the same target. */
  key: string;
  target: string;
  state: "open" | "spent" | "recorded";
}

/** Reservations held for this session. A write spends the oldest open ones. */
export class Reservations {
  private items: Reservation[] = [];
  private next = 1;

  add(channel: string, target: string, key = target): Reservation {
    const r: Reservation = { id: `r${this.next++}`, channel, key, target, state: "open" };
    this.items.push(r);
    return r;
  }

  /** Already reserved this session, in any state — sent, failed or untouched. */
  has(channel: string, key: string): boolean {
    return this.items.some((r) => r.channel === channel && r.key === key);
  }

  open(): Reservation[] {
    return this.items.filter((r) => r.state === "open");
  }

  /** Reserved for a channel and not yet recorded in the ledger. */
  pending(channel: string): number {
    return this.items.filter((r) => r.channel === channel && r.state !== "recorded").length;
  }

  /** Spend `n` open reservations; false (and nothing spent) when there are fewer. */
  spend(n: number): boolean {
    const open = this.open();
    if (open.length < n) return false;
    for (const r of open.slice(0, n)) r.state = "spent";
    return true;
  }

  /** Give back the reservations a blocked or failed call spent. */
  refund(n: number): void {
    const spent = this.items.filter((r) => r.state === "spent").slice(-n);
    for (const r of spent) r.state = "open";
  }

  get(id: string): Reservation | undefined {
    return this.items.find((r) => r.id === id);
  }
}

/** Room left: the limit, minus what the ledger has today, minus what is reserved. */
export function remaining(limit: number, doneToday: number, pending: number): number {
  return Math.max(0, limit - doneToday - pending);
}
