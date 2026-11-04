import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { XHS_FOLLOW_BUTTON, phasesFor, xhsFollowGoal, warmupTypeGoal } from "../lib/flows.ts";

const SCRIPTS = dirname(dirname(fileURLToPath(import.meta.url)));
const ROOT = dirname(dirname(dirname(SCRIPTS)));

test("a warmup treats the invitation note as not a reply, then sends once", () => {
  const goal = warmupTypeGoal("Peng-Nian Chen");
  assert.match(goal, /invitation note/);
  assert.match(goal, /not a reply/);
  assert.match(goal, /New message sheet/);
  assert.match(goal, /Name this chat/);
  assert.match(goal, /Do not tap Send/);
  const phases = phasesFor("warmup", "Peng-Nian Chen", "Hi Peng-Nian! Glad we connected.");
  const type = phases.type as { phases: Array<Record<string, unknown>> };
  assert.deepEqual(type.phases[0].typeTexts, ["Hi Peng-Nian! Glad we connected."]);
  assert.match(String(type.phases[0].pauseWhen), /Send button/);
  const send = phases.send as { countLabel: string; goal: string; repeat: number };
  assert.equal(send.countLabel, "^Send$");
  assert.equal(send.repeat, 1);
  assert.match(send.goal, /Tap Send once/);
  assert.match(send.goal, /without tapping Send again/);
  const clear = phases.clear as { phases: Array<{ goal: string }>; allow_writes?: boolean };
  assert.equal(clear.allow_writes, undefined, "clearing a draft must not spend another reservation");
  assert.match(clear.phases[0].goal, /Do not tap Send/);
  assert.match(String(phases.note), /warmup retry/);
});

test("a Xiaohongshu follow targets the header button and checks it changed", () => {
  const goal = xhsFollowGoal("roselyn");
  assert.match(goal, /red header button/);
  assert.match(goal, /已关注/);
  assert.match(goal, /once more/);
  assert.match(goal, /Do not tap a third time/);
  assert.match(goal, /stats line/);
  assert.match(goal, /source note/);
  assert.match(goal, /操作太频繁/);
  assert.doesNotMatch(goal, /do not tap it; stop/i);
  const follow = (phasesFor("xhs-follow", "roselyn").follow as { phases: Array<Record<string, unknown>> }).phases[0];
  assert.equal(follow.countLabel, XHS_FOLLOW_BUTTON);
  assert.equal((follow.require as { label: string }).label, XHS_FOLLOW_BUTTON);
  assert.doesNotMatch(XHS_FOLLOW_BUTTON, /Following/);
  assert.match("关注", new RegExp(XHS_FOLLOW_BUTTON));
  assert.match("Follow", new RegExp(XHS_FOLLOW_BUTTON));
  assert.match("+ 关注", new RegExp(XHS_FOLLOW_BUTTON));
  assert.doesNotMatch("Following", new RegExp(XHS_FOLLOW_BUTTON));
  assert.doesNotMatch("已关注", new RegExp(XHS_FOLLOW_BUTTON));
  assert.doesNotMatch("12 关注", new RegExp(XHS_FOLLOW_BUTTON));
});

test("the workflow skills carry the same warmup and follow rules", () => {
  const message = readFileSync(join(ROOT, "skills", "linkedin-message-connection", "SKILL.md"), "utf8");
  assert.match(message, /invitation note on the connection request is not a reply/);
  assert.match(message, /New message sheet/);
  assert.match(message, /Tap Send once/);
  assert.match(message, /no draft text remains/);
  const follow = readFileSync(join(ROOT, "skills", "xiaohongshu-follow-commenter-and-like-latest", "SKILL.md"), "utf8");
  assert.match(follow, /red header button beside the nickname/);
  assert.match(follow, /已关注/);
  assert.match(follow, /tap that same header button once more/);
  assert.match(follow, /操作太频繁/);
  const day = readFileSync(join(ROOT, "skills", "outreach-day", "SKILL.md"), "utf8");
  assert.match(day, /read_cards/);
  assert.match(day, /daily_cap_or_sources_exhausted/);
  assert.match(day, /warmup retry/);
  assert.match(day, /phone_clear_text/);
});

test("outreach phases prints the warmup and follow calls", () => {
  const cli = join(SCRIPTS, "outreach.ts");
  const warmup = JSON.parse(
    execFileSync(process.execPath, [cli, "phases", "--flow", "warmup", "--name", "Ada Lovelace", "--text", "Hello Ada"], { encoding: "utf8" }),
  ) as { type: { phases: Array<{ typeTexts: string[] }> } };
  assert.deepEqual(warmup.type.phases[0].typeTexts, ["Hello Ada"]);
  const follow = JSON.parse(
    execFileSync(process.execPath, [cli, "phases", "--flow", "xhs-follow", "--name", "roselyn"], { encoding: "utf8" }),
  ) as { follow: { phases: Array<{ goal: string }> } };
  assert.match(follow.follow.phases[0].goal, /roselyn/);
  let failed = false;
  try {
    execFileSync(process.execPath, [cli, "phases", "--flow", "warmup", "--name", "Ada Lovelace"], { encoding: "utf8", stdio: "pipe" });
  } catch {
    failed = true;
  }
  assert.equal(failed, true, "a warmup with no text is refused");
});
