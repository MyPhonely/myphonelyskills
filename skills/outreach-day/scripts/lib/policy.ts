/**
 * What kind of phone call this is, decided by code: a read, a write, or
 * something never allowed.
 *
 * Pure (no harness, no phone, no files) so it is tested on its own
 * (test/policy.test.ts). guard.ts applies it against the day's reservations
 * for the Claude Code hook and the pi extension.
 *
 * The rules:
 *
 *   1. Writes go through run_task, never through the direct tools. Direct
 *      calls that can write (typing, coordinate taps, long presses, swipes,
 *      files) are refused, and so is a label tap on a write-looking control.
 *   2. A planned run (`request`) may not write: its phases are not known in
 *      advance, so nothing can be checked against them.
 *   3. A writing phase pauses for review (`pauseWhen`) unless the person
 *      chose unattended runs.
 *   4. Every write spends a reservation (guard.ts); `outreach reserve` only
 *      gives one when the records do not have the target, it was not tried
 *      today, and the channel's budget has room.
 *   5. The commit itself, resume_task with writes on, is approved by the
 *      person unless runs are unattended.
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
