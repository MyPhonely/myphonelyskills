/**
 * The rules applied to every MyPhonely call an agent makes, for harnesses that
 * can stop a tool call: a Claude Code PreToolUse hook (`outreach.ts guard`),
 * the pi extension (adapters/pi.ts).
 *
 * policy.ts decides what kind of call it is; this checks it against the day's
 * reservations in the agent's records:
 *
 *   - a call that can write outside run_task is refused, as is a planned run
 *     that writes, and a writing phase with no pause unless unattended;
 *   - each write a run_task phase can make spends one open reservation, so a
 *     write needs `outreach reserve` first and no more writes than reserved;
 *   - the commit (resume_task with writes) is asked of the person unless the
 *     run is unattended. Resuming a write already under way spends nothing.
 *
 * It guards against mistakes, not against an agent set on getting round it:
 * the records are files the agent's own shell can reach.
 */

import { hasCurrentAgent } from "./common.ts";
import { decide } from "./policy.ts";
import { loadDay, saveDay } from "./session.ts";

export interface Verdict {
  /** allow: no objection (the harness's own permissions still apply). */
  decision: "allow" | "deny" | "ask";
  reason: string;
}

export function guard(toolName: string, input: Record<string, unknown>, unattended: boolean): Verdict {
  const d = decide(toolName, input, { unattended, ticketedTasks: new Set() });
  if (d.kind === "read") return { decision: "allow", reason: "" };
  if (d.kind === "blocked") return { decision: "deny", reason: d.reason };

  const isResumeCall = toolName.endsWith("__resume_task");
  // Not an outreach run (a news desk sharing its articles, say): no
  // reservations to keep, but the rest holds. The write goes through
  // run_task, its phase pauses (decide() refused one that does not, unless
  // unattended), and the commit is the person's to approve.
  if (!hasCurrentAgent()) {
    if (isResumeCall && !unattended) return { decision: "ask", reason: d.approve ?? "continue the paused write" };
    return { decision: "allow", reason: "" };
  }

  const day = loadDay();
  const open = day.items.filter((r) => r.state === "open");
  const underway = day.items.filter((r) => r.state === "spent");
  const isResume = toolName.endsWith("__resume_task");

  let spend = d.count;
  if (isResume && underway.length > 0) spend = 0; // the run_task that paused already spent them
  if (spend > open.length) {
    return {
      decision: "deny",
      reason:
        `${spend} write(s) need ${spend} open reservation(s) from \`outreach reserve\`; ${open.length} open. ` +
        "Reserve each target first, and never write to more targets than you reserved.",
    };
  }
  for (const r of open.slice(0, spend)) r.state = "spent";
  if (spend) saveDay(day);

  if (isResume && !unattended) {
    return { decision: "ask", reason: d.approve ?? "continue the paused write" };
  }
  return { decision: "allow", reason: spend ? `${spend} reservation(s) spent` : "" };
}

/**
 * Claude Code's PreToolUse hook: the call arrives as JSON on stdin, the
 * verdict goes back as JSON on stdout. An allow says nothing, so the session's
 * own permission settings still decide; a deny or an ask overrides them.
 */
export function claudeHook(payload: string, unattended: boolean): string {
  let event: { tool_name?: string; tool_input?: Record<string, unknown> };
  try {
    event = JSON.parse(payload) as typeof event;
  } catch {
    return "";
  }
  const v = guard(String(event.tool_name ?? ""), event.tool_input ?? {}, unattended);
  if (v.decision === "allow") return "";
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: v.decision, permissionDecisionReason: v.reason },
  });
}
