import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const SCRIPTS = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(SCRIPTS, "outreach.ts");
const t = (name: string) => `mcp__myphonely__${name}`;

function freshAgent(): string {
  const dir = mkdtempSync(join(tmpdir(), "guard-"));
  cpSync(join(SCRIPTS, "..", "example"), dir, { recursive: true });
  return dir;
}

function env(agent: string | null, unattended = false): NodeJS.ProcessEnv {
  const e = { ...process.env };
  delete e.OUTREACH_STATE;
  delete e.OUTREACH_UNATTENDED;
  if (agent) e.OUTREACH_AGENT = agent;
  else delete e.OUTREACH_AGENT;
  if (unattended) e.OUTREACH_UNATTENDED = "1";
  return e;
}

/** What the Claude Code hook answers for one call: "" (no objection), or the decision. */
function hook(agent: string | null, tool: string, input: Record<string, unknown>, unattended = false): { decision: string; reason: string } {
  const out = execFileSync(process.execPath, [CLI, "guard"], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: t(tool), tool_input: input }),
    encoding: "utf8",
    env: env(agent, unattended),
  }).trim();
  if (!out) return { decision: "allow", reason: "" };
  const h = (JSON.parse(out) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput;
  return { decision: h.permissionDecision, reason: h.permissionDecisionReason };
}

const run = (a: string, args: string[]) => execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: env(a) });

const writing = {
  allow_writes: true,
  phases: [{ goal: "open the post and tap Reply", allowWrites: true, pauseWhen: "the reply composer is open", typeTexts: ["hi"] }],
};

test("reads pass with no agent at all; direct writes and taps on Post never pass", () => {
  assert.equal(hook(null, "phone_screen", {}).decision, "allow");
  assert.equal(hook(null, "run_task", { phases: [{ goal: "read the feed" }] }).decision, "allow");
  assert.equal(hook(null, "phone_type", { text: "hi" }).decision, "deny");
  assert.equal(hook(null, "phone_tap_label", { text: "Post" }).decision, "deny");
  assert.equal(hook(null, "run_task", { allow_writes: true, request: "reply to a post" }).decision, "deny", "a planned run may not write");
});

test("with no outreach agent (a news desk sharing), a paused write needs no reservation but the commit is still asked", () => {
  const share = { allow_writes: true, phases: [{ goal: "open the composer and type the post", allowWrites: true, pauseWhen: "the post is typed" }] };
  assert.equal(hook(null, "run_task", share).decision, "allow");
  const noPause = { allow_writes: true, phases: [{ goal: "post it", allowWrites: true }] };
  assert.equal(hook(null, "run_task", noPause).decision, "deny", "a writing phase must pause when someone is watching");
  assert.equal(hook(null, "resume_task", { task_id: "t1", allowWrites: true }).decision, "ask");
  assert.equal(hook(null, "resume_task", { task_id: "t1", allowWrites: true }, true).decision, "allow", "unattended");
  assert.equal(hook(null, "phone_tap_label", { text: "Post" }).decision, "deny", "direct taps on Post still never pass");
});

test("a writing phase needs an open reservation and spends it; the commit is asked of the person", () => {
  const agent = freshAgent();
  try {
    run(agent, ["init"]);
    const none = hook(agent, "run_task", writing);
    assert.equal(none.decision, "deny");
    assert.match(none.reason, /open reservation/);

    run(agent, ["reserve", "--channel", "x", "--author", "@a", "--title", "first words of the post"]);
    assert.equal(hook(agent, "run_task", writing).decision, "allow", "one reserved, one write");
    assert.equal(hook(agent, "run_task", writing).decision, "deny", "the reservation is spent; a second write needs another");

    const commit = hook(agent, "resume_task", { task_id: "task_1", allowWrites: true, text: "hi", repeat: 1 });
    assert.equal(commit.decision, "ask", "the person approves the commit");
    assert.match(commit.reason, /text: hi/);

    const unpaused = { allow_writes: true, phases: [{ goal: "reply", allowWrites: true }] };
    assert.equal(hook(agent, "run_task", unpaused).decision, "deny", "a write with no review pause");
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("unattended: no pause needed and no question asked, but still no write without a reservation", () => {
  const agent = freshAgent();
  try {
    run(agent, ["init"]);
    const unpaused = { allow_writes: true, phases: [{ goal: "reply", allowWrites: true, repeat: 2 }] };
    assert.equal(hook(agent, "run_task", unpaused, true).decision, "deny", "two writes, nothing reserved");
    run(agent, ["reserve", "--channel", "x", "--author", "@a", "--title", "one post about reviews"]);
    run(agent, ["reserve", "--channel", "x", "--author", "@b", "--title", "two posts about reviews"]);
    assert.equal(hook(agent, "run_task", unpaused, true).decision, "allow");
    assert.equal(hook(agent, "resume_task", { task_id: "task_1", allowWrites: true, text: "hi" }, true).decision, "allow");
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});
