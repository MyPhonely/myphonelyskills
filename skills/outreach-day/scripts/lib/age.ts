/**
 * Turn a post age from a phone screen into hours before `now`.
 *
 * Xiaohongshu returns several shapes for one fact: "1 day(s) ago",
 * "Yesterday 12:18", "10-14", "2024-04-11", "Edited on Apr/10/2024",
 * "Edited on May 21", "3天前", "昨天", "编辑于2024年4月10日". Callers compare
 * `hours` to `max_post_age_hours`. Unrecognized text is null, not a guess.
 */

export interface ParsedAge {
  /** Hours before `now`, rounded to the nearest hour. Null when it is not a date. */
  hours: number | null;
  /** Calendar day YYYY-MM-DD when the text names one, else null. */
  date: string | null;
}

const HOURS: Record<string, number> = {
  second: 1 / 3600,
  minute: 1 / 60,
  hour: 1,
  day: 24,
  week: 24 * 7,
  month: 24 * 30,
  year: 24 * 365,
  秒: 1 / 3600,
  秒钟: 1 / 3600,
  分钟: 1 / 60,
  小时: 1,
  天: 24,
  周: 24 * 7,
  星期: 24 * 7,
  个月: 24 * 30,
  月: 24 * 30,
  年: 24 * 365,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dayStamp(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hoursBetween(then: Date, now: Date): number {
  return Math.round((now.getTime() - then.getTime()) / 3_600_000);
}

function at(year: number, month: number, day: number, hour: number, minute: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

function monthNumber(name: string): number | null {
  return MONTHS[name.toLowerCase().slice(0, 3)] ?? null;
}

function normalize(raw: string): string {
  return raw
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    // "编辑于2024年4月10日" has no space; "Edited on Apr/10/2024" does.
    .replace(/^(?:编辑于|发布于|posted on|posted|edited on|edited)\s*[:：]?\s*/i, "")
    .trim();
}

/** `text` as an age at `now`. `date` is set for a calendar day, not for "3天前". */
export function parseAge(text: string, now = new Date()): ParsedAge {
  const s = normalize(text);
  if (!s) return { hours: null, date: null };
  const none = { hours: null, date: null };

  if (/^(?:刚刚|刚才|just now|moments ago)$/i.test(s)) return { hours: 0, date: null };

  const named = /^(today|今天|yesterday|昨天|前天)(?:\s*(\d{1,2}):(\d{2}))?$/i.exec(s);
  if (named) {
    const word = named[1].toLowerCase();
    const back = word === "前天" ? 2 : word === "yesterday" || word === "昨天" ? 1 : 0;
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const hour = named[2] !== undefined ? Number(named[2]) : back === 0 ? now.getHours() : 12;
    const minute = named[3] !== undefined ? Number(named[3]) : back === 0 ? now.getMinutes() : 0;
    const then = at(day.getFullYear(), day.getMonth() + 1, day.getDate(), hour, minute);
    if (!then) return none;
    return { hours: Math.max(0, hoursBetween(then, now)), date: dayStamp(then) };
  }

  const en = /^(?:an?|(\d+))\s*(second|minute|hour|day|week|month|year)s?(?:\(s\))?\s*ago$/i.exec(s);
  if (en) {
    const n = en[1] ? Number(en[1]) : 1;
    const unit = HOURS[en[2].toLowerCase()];
    if (!unit || n < 0) return none;
    return { hours: Math.round(n * unit), date: null };
  }

  const zh = /^(\d+)\s*(秒钟|秒|分钟|小时|天|星期|周|个月|月|年)\s*前$/.exec(s);
  if (zh) {
    const unit = HOURS[zh[2]];
    if (!unit) return none;
    return { hours: Math.round(Number(zh[1]) * unit), date: null };
  }

  const dated = calendar(s, now);
  if (dated) return dated;

  return none;
}

/** A named or numeric calendar day. Month-day with no year rolls back if it is still ahead of `now`. */
function calendar(s: string, now: Date): ParsedAge | null {
  const named = new RegExp(`^(${MONTH})(?:/(\\d{1,2})/(\\d{4})|\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?)$`, "i").exec(s);
  if (named) {
    const month = monthNumber(named[1]);
    const day = Number(named[2] ?? named[4]);
    const year = named[3] ?? named[5];
    if (!month) return null;
    if (year) {
      const then = at(Number(year), month, day, 12, 0);
      if (!then) return null;
      return { hours: hoursBetween(then, now), date: dayStamp(then) };
    }
    let then = at(now.getFullYear(), month, day, 12, 0);
    if (!then) return null;
    if (then.getTime() > now.getTime()) then = at(now.getFullYear() - 1, month, day, 12, 0);
    if (!then) return null;
    return { hours: hoursBetween(then, now), date: dayStamp(then) };
  }

  const full = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s);
  if (full) {
    const then = at(Number(full[1]), Number(full[2]), Number(full[3]), full[4] !== undefined ? Number(full[4]) : 12, full[5] !== undefined ? Number(full[5]) : 0);
    if (!then) return null;
    return { hours: hoursBetween(then, now), date: dayStamp(then) };
  }

  const md = /^(\d{1,2})[-/.月](\d{1,2})日?(?:\s+(\d{1,2}):(\d{2}))?$/.exec(s);
  if (md) {
    const month = Number(md[1]);
    const day = Number(md[2]);
    const hour = md[3] !== undefined ? Number(md[3]) : 12;
    const minute = md[4] !== undefined ? Number(md[4]) : 0;
    let then = at(now.getFullYear(), month, day, hour, minute);
    if (!then) return null;
    // "12-01" read in October is last December, not a date that has not happened.
    if (then.getTime() > now.getTime()) then = at(now.getFullYear() - 1, month, day, hour, minute);
    if (!then) return null;
    return { hours: hoursBetween(then, now), date: dayStamp(then) };
  }

  return null;
}
