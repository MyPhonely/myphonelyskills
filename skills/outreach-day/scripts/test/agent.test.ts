import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";

import { clean, keysMatch, titleKey } from "../lib/common.ts";
import { commentTargets, connectTargets, renderMessage, rotationFor } from "../lib/plan.ts";
import { personName, postUrlKey } from "../lib/ledger.ts";
import type { Agent } from "../lib/common.ts";

const SCRIPTS = dirname(dirname(fileURLToPath(import.meta.url)));
const EXAMPLE = join(SCRIPTS, "..", "example");
const CLI = join(SCRIPTS, "outreach.ts");
const STATE = mkdtempSync(join(tmpdir(), "outreach-"));
after(() => rmSync(STATE, { recursive: true, force: true }));

/** Run outreach.ts the way the skill tells an agent to; `script` names the old kit script it replaces. */
function run(script: string, args: string[]): { code: number; out: string } {
  const prefix = script === "ledger.ts" ? ["ledger"] : script === "quota.ts" ? ["quota"] : [];
  try {
    const out = execFileSync(process.execPath, [CLI, ...prefix, ...args], {
      encoding: "utf8",
      env: { ...process.env, OUTREACH_STATE: STATE },
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string };
    return { code: e.status ?? 1, out: e.stdout ?? "" };
  }
}

const icp = (values: string[], perDay: number): Agent => ({
  id: "t",
  audience: { titles: ["engineering manager", "head of engineering"], rotate: { dimension: "industry", per_day: perDay, values } },
  channels: { linkedin: { kind: "connect", connects_per_day: 12, batch_size: 3 } },
});

test("every rotation value gets a turn, and the same date always gives the same slice", () => {
  const five = icp(["fintech", "healthtech", "logistics", "devtools", "gaming"], 2);
  const seen = new Set<string>();
  for (let i = 0; i < 21; i++) {
    const d = new Date(2026, 0, 1 + i);
    for (const v of rotationFor(five, d)) seen.add(v);
  }
  // Floor division left the fifth value unreachable forever.
  assert.equal(seen.size, 5);
  const day = new Date(2026, 2, 17);
  assert.deepEqual(rotationFor(five, day), rotationFor(five, day), "a rerun repeats rather than skips");
});

test("each title is searched against each value, with no duplicate query", () => {
  const two = icp(["fintech", "healthtech"], 2);
  const queries = (connectTargets(two, "linkedin", new Date(2026, 0, 1)).dispatches as Array<{ query: string }>).map((p) => p.query);
  assert.deepEqual(new Set(queries).size, queries.length, "no query is issued twice");
  assert.ok(queries.includes("head of engineering fintech"), "the positional zip never searched this pair");
  assert.equal(queries.length, 4);
});

test("a message renders from offer:, and a stale promo refuses to render", () => {
  const base = {
    id: "t",
    audience: { titles: ["x"] },
    channels: {},
    offer: { site: "example.com", per_seat: "per seat", products: [{ price: 19 }, { price: 49 }], promo: { active: false, price: 9, label: "launch" } },
    messages: { warmup: "Try {{site}} from ${{min_price}} {{per_seat}}.", promo: "Now {{promo_label}} at ${{promo_price}}." },
  } as unknown as Agent;
  assert.equal(renderMessage(base, "warmup"), "Try example.com from $19 per seat.");
  assert.throws(() => renderMessage(base, "promo"), /promo\.active is false/);
});

test("free text can never break a row, and title keys survive punctuation", () => {
  assert.equal(clean("a | b\n  c"), "a / b c");
  assert.equal(titleKey("Why our PR queue got so long!!"), titleKey("why our pr queue got so long"));
  assert.ok(keysMatch(titleKey("Why our PR queue got so long"), titleKey("Why our PR queue got so long!!")));
  assert.ok(!keysMatch(titleKey("A completely different post"), titleKey("Why our PR queue got so long")));
  assert.equal(titleKey("笔记 NIW 获批了"), "笔记niw获批了");
});

test("the ledger round-trips a person and refuses a duplicate", () => {
  assert.equal(run("ledger.ts", ["init", "--agent", EXAMPLE]).code, 0);
  assert.equal(run("ledger.ts", ["list-people", "--agent", EXAMPLE]).out.trim(), "-- 0 row(s)", "a fresh ledger has no rows");
  assert.equal(run("ledger.ts", ["check-person", "--agent", EXAMPLE, "--name", "Jane Doe"]).code, 1, "not found exits 1");
  assert.equal(run("ledger.ts", ["add-person", "--agent", EXAMPLE, "--name", "Jane Doe", "--note", "industry: fintech"]).code, 0);
  assert.equal(run("ledger.ts", ["check-person", "--agent", EXAMPLE, "--name", "jane doe"]).code, 0, "found exits 0, case-insensitively");
  assert.equal(run("ledger.ts", ["add-person", "--agent", EXAMPLE, "--name", "Jane Doe"]).code, 1, "duplicate refused");
  assert.equal(run("ledger.ts", ["set-stage", "--agent", EXAMPLE, "--name", "Jane Doe", "--stage", "Warmup Sent", "--touch"]).code, 0);
  assert.match(run("ledger.ts", ["list-people", "--agent", EXAMPLE, "--stage", "Warmup Sent"]).out, /Jane Doe/);
});

test("exclude_headlines keeps the wrong people out of the lead queue", () => {
  // A live post-engagement run filed an immigration attorney as a lead off an
  // NIW post. A topic post draws the people selling to your audience as well
  // as the audience, so this list is load-bearing on that source.
  const icp = parseYaml(readFileSync(join(EXAMPLE, "agent.yaml"), "utf8")) as Agent;
  icp.audience.exclude_headlines = ["attorney", "recruiter", "agency"];

  const hits = (headline: string): boolean =>
    (icp.audience.exclude_headlines ?? []).some((t) =>
      headline.toLocaleLowerCase().includes(String(t).toLocaleLowerCase()),
    );

  assert.equal(hits("Immigration Attorney at Jurado & Associates"), true, "matches regardless of case");
  assert.equal(hits("Technical Recruiter | Hiring PhDs"), true);
  assert.equal(hits("PhD Candidate @ USC"), false, "the actual audience is kept");
  assert.equal(hits("Ph.D. Student at UC San Diego"), false);
});

test("rotate.start pins an ordered list to a known first day", () => {
  const base = parseYaml(readFileSync(join(EXAMPLE, "agent.yaml"), "utf8")) as Agent;
  const values = ["A", "B", "C", "D", "E", "F"];
  base.audience.rotate = { dimension: "school", per_day: 2, values };
  // Local, not UTC: rotationFor reads local date parts, and production always
  // hands it `new Date()`. A UTC-built date lands a day early west of Greenwich.
  const day = (n: number) => new Date(2026, 8, 27 + n);

  // Without a start, the slice is whatever the global epoch makes it. That is
  // stable, but it is not the head of the list, which is the whole complaint.
  const drifted = rotationFor(base, day(0));
  assert.equal(drifted.length, 2);

  // Pinned, day zero is the first block and the list walks in written order.
  base.audience.rotate.start = "2026-09-27";
  assert.deepEqual(rotationFor(base, day(0)), ["A", "B"]);
  assert.deepEqual(rotationFor(base, day(1)), ["C", "D"]);
  assert.deepEqual(rotationFor(base, day(2)), ["E", "F"]);
  assert.deepEqual(rotationFor(base, day(3)), ["A", "B"], "and then it cycles");

  // A date before the start must not produce a negative index.
  assert.deepEqual(rotationFor(base, day(-1)), ["E", "F"]);

  // The block count ceils, so a trailing short block is still reached.
  base.audience.rotate.values = ["A", "B", "C", "D", "E"];
  assert.deepEqual(rotationFor(base, day(2)), ["E"], "the odd last value gets its turn");

  // A malformed start is rejected rather than silently ignored.
  base.audience.rotate.start = "27-09-2026";
  assert.throws(() => rotationFor(base, day(0)), /rotate\.start must be YYYY-MM-DD/);
});

test("post_engagement is a second source into the same pipeline", () => {
  const icp = parseYaml(readFileSync(join(EXAMPLE, "agent.yaml"), "utf8")) as Agent;

  // Default source is the title search, so existing configs are unaffected.
  const people = connectTargets(icp, "linkedin", new Date(Date.UTC(2026, 8, 23)));
  assert.equal(people.source, "people");
  assert.ok((people.dispatches as Array<Record<string, string>>).every((d) => d.query.length > 0));

  // Switched to post engagement, each post keyword becomes one query and the
  // job titles are not used at all.
  icp.channels.linkedin.source = "post_engagement";
  icp.channels.linkedin.post_keywords = ["NIW", "EB-1A"];
  const posts = connectTargets(icp, "linkedin", new Date(Date.UTC(2026, 8, 23)));
  assert.equal(posts.source, "post_engagement");
  const queries = (posts.dispatches as Array<Record<string, string>>).map((d) => d.query);
  assert.deepEqual(queries, ["NIW", "EB-1A"]);
  assert.ok(
    queries.every((q) => !icp.audience.titles.some((t) => q.includes(t))),
    "a post-engagement query is a topic, not a job title",
  );

  // Misconfiguration fails loudly rather than scanning nothing.
  icp.channels.linkedin.post_keywords = [];
  assert.throws(() => connectTargets(icp, "linkedin", new Date()), /post_keywords/);
});

test("a name keeps its identity through LinkedIn's badge decorations", () => {
  // Observed live: a result card's accessibility text is the name with the
  // verified badge and the degree glued on. Every phase joins on the name, so
  // these must all collapse to the same person.
  assert.equal(personName("Sasha S. Verified \u2022 3rd+"), "Sasha S.");
  assert.equal(personName("Naman B. Verified \u2022 3rd+"), "Naman B.");
  assert.equal(personName("Avinash Singh"), "Avinash Singh");
  assert.equal(personName("Jane Doe \u2022 2nd"), "Jane Doe");
  assert.equal(personName("  Grace   Hopper  "), "Grace Hopper");
  // Observed live on the Reactions sheet, which decorates names differently
  // again: the reaction verb is appended instead of the badge.
  assert.equal(personName("Kavya Singh reacted with Like, celebrate"), "Kavya Singh");
  assert.equal(personName("Ben Gioia reacted with Insightful"), "Ben Gioia");
  assert.equal(personName("Dima Abu-Khaled \u2022 3rd+"), "Dima Abu-Khaled");

  const ledger = (args: string[]) => run("ledger.ts", ["--agent", EXAMPLE, ...args]);
  assert.equal(ledger(["init"]).code, 0);
  assert.equal(ledger(["add-lead", "--name", "Decorated Person Verified \u2022 3rd+"]).code, 0);
  // Stored clean, found by the plain name, and not re-discoverable as a dup.
  assert.equal(ledger(["check-person", "--name", "Decorated Person"]).code, 0);
  assert.equal(ledger(["add-lead", "--name", "Decorated Person"]).code, 1);
  assert.match(ledger(["list-people", "--stage", "Lead"]).out, /Decorated Person/);
  assert.doesNotMatch(ledger(["list-people", "--stage", "Lead"]).out, /Verified/);
});

test("a discovered lead costs nothing until it is actually invited", () => {
  const ledger = (args: string[]) => run("ledger.ts", ["--agent", EXAMPLE, ...args]);
  const quota = () => JSON.parse(run("quota.ts", ["--agent", EXAMPLE, "--json"]).out) as Record<string, number>;
  assert.equal(ledger(["init"]).code, 0);
  // The suite shares one state dir, so measure movement, not absolutes.
  const base = quota().sent_7d;

  assert.equal(ledger(["add-lead", "--name", "Ada Lovelace", "--headline", "VP Eng at Acme"]).code, 0);
  assert.equal(ledger(["add-lead", "--name", "Grace Hopper", "--headline", "Head of Eng"]).code, 0);

  // Discovery is read-only outreach: nothing has been sent, so nothing may eat
  // invite headroom. This is what lets you build a queue ahead of the cap.
  assert.equal(quota().sent_7d, base, "a Lead is not a sent invite");

  // The duplicate guard fires at discovery time, before any request goes out.
  assert.equal(ledger(["add-lead", "--name", "Ada Lovelace"]).code, 1, "already known, do not re-discover");
  assert.equal(ledger(["check-person", "--name", "Ada Lovelace"]).code, 0, "check-person catches a Lead too");

  const leads = JSON.parse(ledger(["list-people", "--stage", "Lead", "--json"]).out) as Array<Record<string, string>>;
  const ada = leads.find((r) => r.name === "Ada Lovelace");
  assert.ok(ada, "the lead is queued");
  assert.ok(leads.some((r) => r.name === "Grace Hopper"));
  assert.equal(ada.invited_on, "", "a Lead has no invite date");
  assert.equal(ada.headline, "VP Eng at Acme", "the headline is kept, so fit is reviewable");

  // Only a confirmed send promotes the row, and only then does quota move.
  assert.equal(ledger(["invite", "--name", "Ada Lovelace"]).code, 0);
  assert.equal(quota().sent_7d, base + 1, "an invite counts once it is sent");
  assert.match(ledger(["list-people", "--stage", "Lead"]).out, /Grace Hopper/, "the rest stay queued");
  assert.doesNotMatch(ledger(["list-people", "--stage", "Lead"]).out, /Ada Lovelace/);

  // Someone who was never discovered cannot be marked as invited.
  assert.equal(ledger(["invite", "--name", "Never Seen"]).code, 1);

  // A lead is not messageable, and is not an acceptance either.
  assert.equal(ledger(["accept", "--name", "Grace Hopper"]).code, 0, "no-op: still a Lead, not Invited");
  assert.doesNotMatch(ledger(["list-people", "--stage", "Connected"]).out, /Grace Hopper/);
});

test("a reply puts someone in the answer queue until we answer them", () => {
  const ledger = (args: string[]) => run("ledger.ts", ["--agent", EXAMPLE, ...args]);
  assert.equal(ledger(["init"]).code, 0);
  assert.equal(ledger(["add-person", "--name", "Talkative Person"]).code, 0);
  assert.equal(ledger(["accept", "--name", "Talkative Person"]).code, 0);
  assert.equal(ledger(["set-stage", "--name", "Talkative Person", "--stage", "Warmup Sent", "--touch"]).code, 0);

  // They write back. Their words are kept verbatim: the send run needs them,
  // and it is the only record of what was actually said.
  assert.equal(
    ledger(["set-stage", "--name", "Talkative Person", "--stage", "Replied", "--note", "Replied: is this for F-1 students?"]).code,
    0,
  );
  const queue = () => ledger(["list-people", "--stage", "Replied"]).out;
  assert.match(queue(), /Talkative Person/, "they are owed an answer");

  // Answering clears the queue, so tomorrow's collection ignores them unless
  // they write again.
  assert.equal(ledger(["set-stage", "--name", "Talkative Person", "--stage", "Answered", "--touch"]).code, 0);
  assert.doesNotMatch(queue(), /Talkative Person/, "answered people leave the queue");

  const rows = JSON.parse(ledger(["list-people", "--stage", "Answered", "--json"]).out) as Array<Record<string, string>>;
  const row = rows.find((r) => r.name === "Talkative Person");
  assert.ok(row);
  assert.match(row.last_message, /^\d{4}-\d{2}-\d{2}$/, "the answer date is stamped");

  // Someone who declines leaves the pipeline rather than sitting in the queue.
  assert.equal(ledger(["add-person", "--name", "Polite Decliner"]).code, 0);
  assert.equal(ledger(["set-stage", "--name", "Polite Decliner", "--stage", "Replied", "--note", "no thanks"]).code, 0);
  assert.equal(ledger(["set-stage", "--name", "Polite Decliner", "--stage", "Not Interested"]).code, 0);
  assert.doesNotMatch(queue(), /Polite Decliner/);
});

test("a rejected profile is remembered so it is never re-opened or counted", () => {
  const ledger = (args: string[]) => run("ledger.ts", ["--agent", EXAMPLE, ...args]);
  const quota = () => JSON.parse(run("quota.ts", ["--agent", EXAMPLE, "--json"]).out) as Record<string, number>;
  assert.equal(ledger(["init"]).code, 0);
  const base = quota().sent_7d;

  // Scanned from a card, then the profile was opened and did not fit.
  assert.equal(ledger(["add-lead", "--name", "Wrong Fit", "--headline", "PhD student"]).code, 0);
  assert.equal(ledger(["set-stage", "--name", "Wrong Fit", "--stage", "Disqualified", "--note", "undergrad in the US"]).code, 0);

  // Opening a profile is the expensive step, so the verdict is cached: the
  // next scan sees them as known and skips before paying for the profile.
  assert.equal(ledger(["check-person", "--name", "Wrong Fit"]).code, 0, "a future scan skips them");
  assert.equal(ledger(["add-lead", "--name", "Wrong Fit"]).code, 1, "not re-discovered");

  // Nothing was ever sent to them, so they must not consume invite headroom.
  assert.equal(quota().sent_7d, base, "a Disqualified row is not a sent invite");
  const rows = JSON.parse(ledger(["list-people", "--stage", "Disqualified", "--json"]).out) as Array<Record<string, string>>;
  assert.equal(rows.find((r) => r.name === "Wrong Fit")?.invited_on, "", "no invite date");

  // The same must hold when the row is written straight at that stage.
  assert.equal(ledger(["add-person", "--name", "Direct Reject", "--stage", "Disqualified"]).code, 0);
  assert.equal(quota().sent_7d, base, "writing a Disqualified row directly still costs no quota");

  // But a real invite that later goes nowhere DOES stay counted, because
  // LinkedIn counts requests sent and withdrawing does not return the slot.
  assert.equal(ledger(["add-person", "--name", "Real Invite"]).code, 0);
  assert.equal(ledger(["set-stage", "--name", "Real Invite", "--stage", "Withdrawn"]).code, 0);
  assert.equal(quota().sent_7d, base + 1, "a withdrawn invite was still sent");
});

test("a sent invite is not a connection until it is accepted", () => {
  const ledger = (args: string[]) => run("ledger.ts", ["--agent", EXAMPLE, ...args]);
  assert.equal(ledger(["init"]).code, 0);
  assert.equal(ledger(["add-person", "--name", "Pending Person"]).code, 0);

  // Filed as Invited, not Connected -- the whole point. An un-accepted invite
  // must never appear in the warmup pool, because LinkedIn will not deliver a
  // message to a non-connection.
  assert.match(ledger(["list-people", "--stage", "Invited"]).out, /Pending Person/);
  assert.doesNotMatch(
    ledger(["list-people", "--stage", "Connected", "--no-message"]).out,
    /Pending Person/,
    "an invite that was merely sent is not in the warmup pool",
  );

  // Someone the phone shows as a connection but we never invited: skipped,
  // not silently added, so strangers cannot enter the pipeline.
  assert.equal(ledger(["accept", "--name", "Total Stranger"]).code, 1);
  assert.doesNotMatch(ledger(["list-people"]).out, /Total Stranger/);

  // Accepting promotes exactly one row and stamps accepted_on.
  assert.equal(ledger(["accept", "--name", "Pending Person"]).code, 0);
  const pool = ledger(["list-people", "--stage", "Connected", "--no-message", "--json"]).out;
  const rows = JSON.parse(pool) as Array<Record<string, string>>;
  const row = rows.find((r) => r.name === "Pending Person");
  assert.ok(row, "accepted person is now in the warmup pool");
  assert.match(row.accepted_on, /^\d{4}-\d{2}-\d{2}$/, "accepted_on is stamped");
  assert.equal(row.last_message, "", "not yet messaged");

  // The Connections card carries its own "Connected on" date; it is recorded
  // verbatim rather than assumed to be today, so warmup_delay_days is honest.
  assert.equal(ledger(["add-person", "--name", "Dated Person"]).code, 0);
  assert.equal(ledger(["accept", "--name", "Dated Person", "--accepted-on", "2026-09-18"]).code, 0);
  const dated = (JSON.parse(ledger(["list-people", "--stage", "Connected", "--json"]).out) as Array<Record<string, string>>)
    .find((r) => r.name === "Dated Person");
  assert.equal(dated?.accepted_on, "2026-09-18");

  // Re-running the harvest is a no-op, so it is safe to run every time.
  const connectedCount = (): number =>
    (JSON.parse(ledger(["list-people", "--stage", "Connected", "--json"]).out) as unknown[]).length;
  const before = connectedCount();
  assert.equal(ledger(["accept", "--name", "Pending Person"]).code, 0);
  assert.equal(connectedCount(), before, "a second accept does not duplicate the row");

  // Once warmed, they leave the pool.
  assert.equal(ledger(["set-stage", "--name", "Pending Person", "--stage", "Warmup Sent", "--touch"]).code, 0);
  assert.doesNotMatch(ledger(["list-people", "--stage", "Connected", "--no-message"]).out, /Pending Person/);
});

test("stale-invite withdrawal reads the invite date, not the acceptance", () => {
  const ledger = (args: string[]) => run("ledger.ts", ["--agent", EXAMPLE, ...args]);
  assert.equal(ledger(["init"]).code, 0);
  assert.equal(ledger(["add-person", "--name", "Old Invite", "--date", "2020-01-01"]).code, 0);
  assert.equal(ledger(["add-person", "--name", "Fresh Invite"]).code, 0);

  const stale = ledger(["list-people", "--stage", "Invited", "--no-message", "--older-than", "30"]).out;
  assert.match(stale, /Old Invite/);
  assert.doesNotMatch(stale, /Fresh Invite/, "a request sent today is not stale");

  assert.equal(ledger(["set-stage", "--name", "Old Invite", "--stage", "Withdrawn"]).code, 0);
  assert.doesNotMatch(
    ledger(["list-people", "--stage", "Invited", "--older-than", "30"]).out,
    /Old Invite/,
    "a withdrawn row is no longer offered for withdrawal",
  );
});

test("post dedup matches across platform aliases and punctuation", () => {
  run("ledger.ts", ["init", "--agent", EXAMPLE]);
  run("ledger.ts", ["add-post", "--agent", EXAMPLE, "--platform", "x", "--author", "@dev", "--title", "Why our PR queue got so long"]);
  assert.equal(
    run("ledger.ts", ["check-post", "--agent", EXAMPLE, "--platform", "twitter", "--author", "@DEV", "--title", "Why our PR queue got so long!!"]).code,
    0,
    "twitter is x, case and punctuation do not matter",
  );
  assert.equal(
    run("ledger.ts", ["check-post", "--agent", EXAMPLE, "--platform", "x", "--author", "@dev", "--title", "A completely different post"]).code,
    1,
  );
});

test("quota reads the ledger and signals the cap through its exit status", () => {
  const out = JSON.parse(run("quota.ts", ["--agent", EXAMPLE, "--json"]).out);
  assert.equal(out.cap, 100, "the example ICP's weekly cap");
  assert.equal(out.allowed_today, Math.min(out.daily_target - out.sent_today, out.remaining));
  assert.equal(run("quota.ts", ["--agent", EXAMPLE, "--cap", "0", "--json"]).code, 1, "no headroom exits 1");
  assert.equal(JSON.parse(run("quota.ts", ["--agent", EXAMPLE, "--cap", "0", "--json"]).out).capped_by, "week");
});

test("the daily target survives a second run on the same day", () => {
  // The bug this covers: allowed_today was min(daily_target, weekly_remaining)
  // and never subtracted what today had already sent, so re-running the
  // pipeline handed out the full daily allowance again.
  const icp = EXAMPLE;
  const state = mkdtempSync(join(tmpdir(), "quota-"));
  // quota exits 1 once nothing more may be sent, which is the behaviour under
  // test, so read stdout rather than letting execFileSync throw on it.
  const q = (): Record<string, number | string | null> => {
    let text: string;
    try {
      text = execFileSync(process.execPath, [CLI, "quota", "--agent", icp, "--json"], {
        encoding: "utf8",
        env: { ...process.env, OUTREACH_STATE: state },
      });
    } catch (error) {
      text = (error as { stdout?: string }).stdout ?? "";
    }
    return JSON.parse(text.slice(0, text.lastIndexOf("}") + 1)) as Record<string, number | string | null>;
  };
  const add = (name: string, date?: string): void => {
    execFileSync(
      process.execPath,
      [CLI, "ledger", "add-person", "--agent", icp, "--name", name, ...(date ? ["--date", date] : [])],
      { encoding: "utf8", env: { ...process.env, OUTREACH_STATE: state }, stdio: "pipe" },
    );
  };
  execFileSync(process.execPath, [CLI, "ledger", "init", "--agent", icp], {
    env: { ...process.env, OUTREACH_STATE: state },
    stdio: "pipe",
  });

  const perDay = Number(q().daily_target);
  assert.equal(q().allowed_today, perDay, "a fresh day offers the whole target");

  add("Half Way");
  assert.equal(q().sent_today, 1);
  assert.equal(q().allowed_today, perDay - 1, "a partial run leaves only the remainder");

  for (let i = 1; i < perDay; i++) add(`Filler ${i}`);
  const full = q();
  assert.equal(full.sent_today, perDay);
  assert.equal(full.allowed_today, 0, "the daily target is spent");
  assert.equal(full.capped_by, "day", "capped by the day, not the week");
  assert.ok(Number(full.remaining) > 0, "the weekly cap still has room, which is the whole point");

  // Yesterday's invites count against the week but not against today.
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  add("Old One", yesterday.toISOString().slice(0, 10));
  assert.equal(q().sent_today, perDay, "a dated-yesterday row does not change today's count");

  rmSync(state, { recursive: true, force: true });
});

test("the example agent still describes three channels the workflow can run", () => {
  const plan = JSON.parse(run("plan", ["channels", "--agent", EXAMPLE, "--json"]).out);
  assert.deepEqual(plan, [
    { name: "linkedin", kind: "connect" },
    { name: "x", kind: "comment" },
    { name: "reddit", kind: "comment" },
  ]);
  const reddit = JSON.parse(run("plan", ["targets", "--agent", EXAMPLE, "--channel", "reddit", "--json"]).out);
  assert.equal(reddit.dispatches[0].scope, "r/ExperiencedDevs", "targets scope a keyword to one subreddit");
});

test("an X channel searches with exclusions, reads lists first and stops at the daily ceiling", () => {
  const x: Agent = {
    id: "t",
    audience: { titles: ["t"] },
    channels: {
      x: {
        kind: "comment",
        posts_per_keyword: 3,
        comments_per_day: 7,
        tab: "latest",
        max_post_age_hours: 48,
        exclude_terms: ["attorney", "free consultation"],
        lists: ["https://x.com/i/lists/1"],
        keywords: ["EB-2 NIW", "NIW RFE", "EB1A"],
        dm: { only_after_engagement: true },
      },
    },
  };
  const plan = commentTargets(x, "x", new Date("2026-10-01")) as { dispatches: Array<Record<string, unknown>> } & Record<string, unknown>;
  assert.equal(plan.dispatches[0].list, "https://x.com/i/lists/1", "the list is read before any search");
  assert.equal(plan.dispatches[1].query, 'EB-2 NIW -attorney -"free consultation"');
  const posts = plan.dispatches.map((d) => d.posts as number);
  assert.deepEqual(posts, [3, 3, 1], "7 a day: the list, the first keyword, one from the second, none from the third");
  assert.equal(plan.tab, "latest");
  assert.equal(plan.max_post_age_hours, 48);
  assert.deepEqual(plan.dm, { only_after_engagement: true });
});

test("a channel without the X options plans exactly as before", () => {
  const plain: Agent = { id: "t", audience: { titles: ["t"] }, channels: { x: { kind: "comment", keywords: ["a", "b"] } } };
  const plan = commentTargets(plain, "x", new Date("2026-10-01")) as { dispatches: Array<Record<string, unknown>> } & Record<string, unknown>;
  assert.deepEqual(plan.dispatches.map((d) => [d.keyword, d.posts]), [["a", 3], ["b", 3]]);
  assert.equal(plan.comments_per_day, undefined);
  assert.equal(plan.tab, undefined);
});

test("one X post has one URL key however it was copied", () => {
  const k = "x.com/status/1840000000000000000";
  assert.equal(postUrlKey("https://twitter.com/jane/status/1840000000000000000?s=20"), k);
  assert.equal(postUrlKey("https://x.com/Jane_Renamed/status/1840000000000000000/photo/1"), k);
  assert.equal(postUrlKey("https://mobile.x.com/jane/status/1840000000000000000/"), k);
  assert.equal(postUrlKey("https://www.reddit.com/r/PhD/comments/abc/x/?utm=1"), "reddit.com/r/phd/comments/abc/x");
});

test("check-post finds an X post by URL even when the snippet was read differently", () => {
  run("ledger.ts", ["init", "--agent", EXAMPLE]);
  const url = "https://x.com/jane/status/1840000000000000001";
  assert.equal(
    run("ledger.ts", ["add-post", "--agent", EXAMPLE, "--platform", "x", "--author", "@jane", "--title", "Just got my NIW RFE, what now", "--url", url]).code,
    0,
  );
  const other = ["check-post", "--agent", EXAMPLE, "--platform", "x", "--author", "@jane", "--title", "a different read of the same post"];
  assert.equal(run("ledger.ts", other).code, 1, "no URL and a different snippet: not found, as before");
  assert.equal(run("ledger.ts", [...other, "--url", "https://twitter.com/jane/status/1840000000000000001?s=46"]).code, 0, "the URL finds it");
  assert.equal(
    run("ledger.ts", ["check-post", "--agent", EXAMPLE, "--platform", "reddit", "--author", "@jane", "--title", "x", "--url", url]).code,
    1,
    "a URL match is still per platform",
  );
});

test("a stream of a platform plans in that app and shares its dedup history", () => {
  const two: Agent = {
    id: "t",
    audience: { titles: ["t"] },
    channels: {
      x: { kind: "comment", keywords: ["NIW PhD"] },
      "x-papers": { kind: "comment", keywords: ["paper accepted NeurIPS"], follow: true, angle: "paper accepted" },
    },
  };
  const plan = commentTargets(two, "x-papers", new Date("2026-10-01")) as Record<string, unknown>;
  assert.equal(plan.app, "x");
  assert.equal(plan.follow, true);
  assert.equal(plan.angle, "paper accepted");
  assert.equal((commentTargets(two, "x", new Date("2026-10-01")) as Record<string, unknown>).app, "x");

  run("ledger.ts", ["init", "--agent", EXAMPLE]);
  const url = "https://x.com/lab/status/1840000000000000002";
  run("ledger.ts", ["add-post", "--agent", EXAMPLE, "--platform", "x-papers", "--author", "@lab", "--title", "Our paper was accepted", "--url", url]);
  assert.equal(
    run("ledger.ts", ["check-post", "--agent", EXAMPLE, "--platform", "x", "--author", "@lab", "--title", "other", "--url", url]).code,
    0,
    "commented from the papers stream counts on x",
  );
});
