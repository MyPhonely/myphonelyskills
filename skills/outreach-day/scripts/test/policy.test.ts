import assert from "node:assert/strict";
import { test } from "node:test";

import { countPosts } from "../lib/ledger.ts";
import { decide, phoneTool, targetKey } from "../lib/policy.ts";

const attended = { unattended: false, ticketedTasks: new Set<string>() };
const unattended = { unattended: true, ticketedTasks: new Set<string>() };
const t = (name: string) => `mcp__myphonely__${name}`;

test("only MyPhonely tools are judged; reading and navigating are free", () => {
  assert.equal(phoneTool("read"), null);
  assert.deepEqual(decide("read", { path: "x" }, attended), { kind: "read" });
  for (const name of ["phone_status", "phone_screen", "phone_scroll", "phone_open_url", "get_task_status", "phone_read", "acquire_phone"]) {
    assert.equal(decide(t(name), {}, attended).kind, "read", name);
  }
  assert.equal(decide(t("phone_tap_label"), { text: "Latest" }, attended).kind, "read");
  assert.equal(decide(t("run_task"), { phases: [{ goal: "read the feed" }] }, attended).kind, "read", "no allow_writes, no write");
});

test("Mode 2 never writes: typing, coordinate taps and write-looking labels are refused", () => {
  for (const name of ["phone_type", "phone_tap", "phone_long_press", "phone_swipe", "phone_clear_text", "phone_push_file"]) {
    assert.equal(decide(t(name), {}, attended).kind, "blocked", name);
  }
  for (const label of ["Post", "Reply", "Send", "Invite Jane Doe to connect", "Follow", "Like", "Withdraw", "Message"]) {
    assert.equal(decide(t("phone_tap_label"), { text: label }, unattended).kind, "blocked", label);
  }
});

test("a planned run may not write, and a writing phase must pause for review", () => {
  assert.equal(decide(t("run_task"), { request: "reply to posts", allow_writes: true }, unattended).kind, "blocked");
  const noPause = { allow_writes: true, phases: [{ goal: "reply", allowWrites: true }] };
  assert.equal(decide(t("run_task"), noPause, attended).kind, "blocked");
  assert.deepEqual(decide(t("run_task"), noPause, unattended), { kind: "write", count: 1, approve: null }, "unattended may skip the pause");
  const paused = { allow_writes: true, phases: [{ goal: "open the composer", allowWrites: true, pauseWhen: "composer open" }, { goal: "invite", allowWrites: true, pauseWhen: "card", repeat: 3 }] };
  assert.deepEqual(decide(t("run_task"), paused, attended), { kind: "write", count: 4, approve: null }, "repeat counts each write");
  assert.equal(decide(t("run_task"), { allow_writes: true, phases: [{ goal: "navigate" }] }, attended).kind, "read", "master switch on, no writing phase");
});

test("the commit is the resume: it needs approval, and a reservation unless the run already spent one", () => {
  const fresh = decide(t("resume_task"), { task_id: "task_1", text: "Congrats on DUET!", allowWrites: true }, attended);
  assert.equal(fresh.kind, "write");
  assert.ok(fresh.kind === "write" && fresh.count === 1 && /Congrats on DUET/.test(fresh.approve ?? ""));
  const ticketed = decide(t("resume_task"), { task_id: "task_2", text: "hi" }, { unattended: false, ticketedTasks: new Set(["task_2"]) });
  assert.ok(ticketed.kind === "write" && ticketed.count === 0 && ticketed.approve !== null, "already reserved, still approved");
  assert.equal(decide(t("resume_task"), { task_id: "task_1", abandon: true }, attended).kind, "read");
  assert.equal(decide(t("resume_task"), { task_id: "task_9", goal: "scroll on" }, attended).kind, "read", "a resume that cannot write");
  const auto = decide(t("resume_task"), { task_id: "task_1", text: "x", allowWrites: true }, unattended);
  assert.ok(auto.kind === "write" && auto.approve === null);
});

test("budget: today's ledger rows count per channel", () => {
  const rows: Array<[number, string]> = [
    [1, "2026-10-05 | x-papers | @a | k | t | u"],
    [2, "2026-10-05 | x | @b | k | t | u"],
    [3, "2026-10-04 | x-papers | @c | k | t | u"],
    [4, "2026-10-05 | X-Papers | @d | k | t | u"],
  ];
  assert.equal(countPosts("x-papers", "2026-10-05", rows), 2, "today's, this channel only, case-insensitive");
  assert.equal(countPosts("x", "2026-10-05", rows), 1, "x and x-papers keep separate budgets");
});

test("a target has one spelling: case, spacing and how a URL was copied do not make it new", () => {
  const post = targetKey({ author: "momo", title: "工科PhD在读NIW求建议" });
  assert.equal(targetKey({ author: "MOMO ", title: "工科PhD在读NIW求建议" }), post);
  assert.notEqual(targetKey({ author: "momo", title: "another post" }), post);
  assert.equal(
    targetKey({ url: "https://www.reddit.com/r/EB2_NIW/comments/abc/x/?utm=1" }),
    targetKey({ url: "reddit.com/r/EB2_NIW/comments/abc/x" }),
    "a URL is the same target however it was copied",
  );
  assert.equal(targetKey({ name: "Jane  Doe" }), targetKey({ name: "jane doe" }));
  assert.notEqual(targetKey({ name: "Jane Doe" }), targetKey({ author: "Jane Doe", title: "" }), "a person is not a post");
});
