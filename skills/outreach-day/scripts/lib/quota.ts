/**
 * LinkedIn invite-quota accounting, read off the people ledger.
 *
 *     outreach.ts quota              # human-readable
 *     outreach.ts quota --json       # {"sent_7d":.., "remaining":.., "allowed_today":..}
 *     outreach.ts quota --days 7 --cap 100
 *
 * LinkedIn restricts accounts around 100 invites a week, so treat the cap as
 * hard. 20 a day is sustainable five days a week, not seven (20 x 7 = 140 >
 * 100). This script is what keeps that honest instead of a model doing date
 * arithmetic in a prompt.
 *
 * Two limits apply at once and BOTH are enforced. The weekly cap is what
 * protects the account; the daily target is the pacing you chose. `sent_today`
 * is subtracted from the daily target, so running the pipeline twice in one
 * day cannot send twice the daily number.
 *
 * Exit status: 0 while another invite may be sent right now, 1 when it may
 * not -- whether that is the weekly cap or the daily target. `capped_by` says
 * which, so a caller can branch on the status alone.
 */

import { dataRows, emit, fields, ledgerPath, loadAgent, parse, setCurrentAgent, today } from "./common.ts";
import type { Agent } from "./common.ts";

/**
 * Count people-ledger rows whose invited_on is strictly after the cutoff.
 *
 * Every row is an invite that was sent, so withdrawn and unaccepted rows still
 * count: LinkedIn's weekly limit counts requests sent, and withdrawing one
 * does not hand the slot back.
 */
function invitesSent(): Array<{ on: string; name: string; when: Date }> {
  const out: Array<{ on: string; name: string; when: Date }> = [];
  for (const [, row] of dataRows(ledgerPath("people"))) {
    const f = fields(row);
    if (f.length < 5) continue;
    // A Lead or a Disqualified row was never contacted, so it must not eat
    // invite headroom. Its invited_on is empty and parses to NaN anyway; this
    // says so explicitly rather than relying on that.
    if (f[0] === "Lead" || f[0] === "Disqualified") continue;
    const on = f[4];
    const when = new Date(`${on}T00:00:00`);
    if (Number.isNaN(when.getTime())) continue;
    out.push({ on, name: f[1], when });
  }
  return out;
}

export function sentSince(cutoff: Date): { count: number; names: string[] } {
  const names = invitesSent()
    .filter((r) => r.when > cutoff)
    .map((r) => `${r.on}  ${r.name}`);
  return { count: names.length, names };
}

/**
 * Invites already sent today.
 *
 * Without this the daily target was never actually enforced: it was compared
 * against the weekly total only, so a second run on the same day was handed
 * the full daily allowance again.
 */
export function sentOn(day: string): number {
  return invitesSent().filter((r) => r.on === day).length;
}

export interface InviteRoom {
  days: number;
  since: string;
  sent: number;
  cap: number;
  remaining: number;
  perDay: number;
  sentToday: number;
  allowedToday: number;
  cappedBy: "week" | "day" | null;
}

/**
 * How many LinkedIn invites may go out right now: the daily target minus
 * today's, bounded by the weekly cap minus the last `days` days'. The agent's
 * records must already be current (setCurrentAgent).
 */
export function inviteRoom(agent: Agent | null, days = 7, capOverride?: number): InviteRoom {
  const li = (agent?.channels?.linkedin ?? {}) as Record<string, unknown>;
  const cap = capOverride ?? Number(li.weekly_invite_cap ?? 100);
  const perDay = Number(li.connects_per_day ?? 20);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const { count: sent } = sentSince(cutoff);
  const remaining = Math.max(0, cap - sent);
  const sentToday = sentOn(today());
  const leftToday = Math.max(0, perDay - sentToday);
  const allowedToday = Math.min(leftToday, remaining);
  const cappedBy = remaining === 0 ? "week" : leftToday === 0 ? "day" : null;
  return { days, since: cutoff.toISOString().slice(0, 10), sent, cap, remaining, perDay, sentToday, allowedToday, cappedBy };
}

export function main(argv: string[]): number {
  const v = parse(argv, {
    agent: { type: "string" },
    days: { type: "string", default: "7" },
    cap: { type: "string" },
    names: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  });
  const days = Number(v.days);
  let agent: Agent | null = null;
  try {
    agent = loadAgent(v.agent as string | undefined);
    setCurrentAgent(agent); // so the ledger resolves per agent
  } catch {
    // No agent: $OUTREACH_STATE names the records, and the defaults apply.
  }
  const room = inviteRoom(agent, days, v.cap === undefined ? undefined : Number(v.cap));
  const { sent, cap: hardCap, remaining, perDay, sentToday, allowedToday, cappedBy } = room;
  const names = v.names ? sentSince(new Date(`${room.since}T00:00:00`)).names : [];

  const out: Record<string, unknown> = {
    window_days: days,
    since: room.since,
    [`sent_${days}d`]: sent,
    cap: hardCap,
    remaining,
    daily_target: perDay,
    sent_today: sentToday,
    allowed_today: allowedToday,
    capped: allowedToday === 0,
    capped_by: cappedBy,
  };
  if (v.names) out.rows = names;
  emit(out, Boolean(v.json));

  if (cappedBy === "day") {
    console.log(
      `note: the ${perDay}/day target is already used up (${sentToday} sent today). ` +
        `${remaining} remain under the ${hardCap}/wk cap -- wait for tomorrow rather than topping up.`,
    );
  } else if (allowedToday > 0 && remaining < perDay) {
    console.log(
      `note: only ${remaining} left under the ${hardCap}/wk cap (below the ${perDay}/day target) ` +
        "-- connect that many and say so in the run report.",
    );
  }
  return allowedToday > 0 ? 0 : 1;
}

