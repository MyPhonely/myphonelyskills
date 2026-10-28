import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { parseAge } from "../lib/age.ts";

const CLI = join(dirname(dirname(fileURLToPath(import.meta.url))), "outreach.ts");
const now = new Date(2026, 9, 28, 15, 0, 0);

test("post ages from a phone normalize to hours", () => {
  assert.equal(parseAge("1 day(s) ago", now).hours, 24);
  assert.equal(parseAge("2 hours ago", now).hours, 2);
  assert.equal(parseAge("an hour ago", now).hours, 1);
  assert.equal(parseAge("1 week ago", now).hours, 168);
  assert.equal(parseAge("刚刚", now).hours, 0);
  assert.equal(parseAge("3天前", now).hours, 72);
  assert.equal(parseAge("３天前", now).hours, 72, "fullwidth digits");
  assert.equal(parseAge("1个月前", now).hours, 720);
  assert.equal(parseAge("编辑于 昨天", now).date, "2026-10-27");
  assert.equal(parseAge("昨天", now).hours, 27, "yesterday at noon, before 15:00");
  assert.equal(parseAge("Yesterday 12:18", now).date, "2026-10-27");
  assert.equal(parseAge("Yesterday 12:18", now).hours, 27);
  assert.equal(parseAge("前天", now).date, "2026-10-26");
  assert.equal(parseAge("今天", now).hours, 0);
  assert.deepEqual(parseAge("10-14", now), { hours: 339, date: "2026-10-14" });
  assert.equal(parseAge("2024-04-11", now).date, "2024-04-11");
  assert.equal(parseAge("2024年4月11日", now).date, "2024-04-11");
  assert.equal(
    parseAge("2024-04-11", now).hours,
    Math.round((now.getTime() - new Date(2024, 3, 11, 12, 0, 0).getTime()) / 3_600_000),
  );
  assert.equal(parseAge("12-01", now).date, "2025-12-01", "a month-day still in the future is last year");
  assert.equal(parseAge("not a date", now).hours, null);
  assert.equal(parseAge("13-40", now).hours, null);
  assert.equal(parseAge("", now).hours, null);
});

test("outreach age reports hours and whether the note is inside the window", () => {
  const run = (args: string[]) =>
    JSON.parse(execFileSync(process.execPath, [CLI, "age", ...args, "--json"], { encoding: "utf8" })) as {
      hours: number | null;
      within: boolean | null;
      date: string | null;
    };
  const fresh = run(["--text", "3天前", "--now", "2026-10-28T15:00:00", "--max-hours", "168"]);
  assert.equal(fresh.hours, 72);
  assert.equal(fresh.within, true);
  const old = run(["--text", "2024-04-11", "--now", "2026-10-28T15:00:00", "--max-hours", "168"]);
  assert.equal(old.date, "2024-04-11");
  assert.equal(old.within, false);
  const unknown = run(["--text", "sometime", "--now", "2026-10-28T15:00:00", "--max-hours", "168"]);
  assert.equal(unknown.hours, null);
  assert.equal(unknown.within, null);
});
