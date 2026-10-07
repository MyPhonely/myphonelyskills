import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const SCRIPTS = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(SCRIPTS, "outreach.ts");

/** A fresh copy of the example agent, with its records inside it. */
function freshAgent(edit?: (yaml: string) => string): string {
  const dir = mkdtempSync(join(tmpdir(), "agent-"));
  cpSync(join(SCRIPTS, "..", "example"), dir, { recursive: true });
  if (edit) {
    const p = join(dir, "agent.yaml");
    writeFileSync(p, edit(execFileSync("cat", [p], { encoding: "utf8" })));
  }
  return dir;
}

function cli(agent: string, args: string[]): { code: number; out: string; err: string } {
  const env = { ...process.env };
  delete env.OUTREACH_STATE;
  delete env.OUTREACH_AGENT;
  try {
    const out = execFileSync(process.execPath, [CLI, ...args, "--agent", agent], { encoding: "utf8", env, stdio: "pipe" });
    return { code: 0, out, err: "" };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: e.stdout ?? "", err: e.stderr ?? "" };
  }
}

const json = (r: { out: string }) => JSON.parse(r.out) as Record<string, unknown>;

test("records default to records/ inside the agent folder, and show lists the files to read", () => {
  const agent = freshAgent();
  try {
    assert.equal(cli(agent, ["init"]).code, 0);
    assert.ok(existsSync(join(agent, "records", "commented-posts.md")));
    const show = json(cli(agent, ["show", "--json"]));
    assert.equal(show.records, join(agent, "records"));
    assert.equal(show.brand, join(agent, "brand.md"));
    assert.equal(show.voice, join(agent, "voice.md"));
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("a post is reserved once a day, recorded, and then refused as already done", () => {
  const agent = freshAgent();
  try {
    cli(agent, ["init"]);
    const post = ["--channel", "x", "--author", "@dev", "--title", "Why our PR queue got so long", "--url", "https://x.com/dev/status/1"];
    assert.equal(cli(agent, ["check", ...post]).code, 1, "not done before");
    const r1 = json(cli(agent, ["reserve", ...post, "--json"]));
    assert.equal(r1.reserved, "r1");

    const again = cli(agent, ["reserve", ...post]);
    assert.equal(again.code, 3, "a second reservation the same day is refused");
    assert.match(again.err, /already reserved today/);

    assert.equal(cli(agent, ["record", "--reservation", "r1", "--outcome", "sent", ...post.slice(2), "--comment", "Nice."]).code, 0);
    assert.equal(cli(agent, ["check", ...post]).code, 0, "the records have it now");
    assert.equal(cli(agent, ["record", "--reservation", "r1", "--outcome", "sent", ...post.slice(2)]).code, 2, "settled once");

    // A different read of the same post, by its URL.
    const same = ["--channel", "x", "--author", "@dev", "--title", "other words", "--url", "https://twitter.com/dev/status/1?s=20"];
    const refused = cli(agent, ["reserve", ...same]);
    assert.equal(refused.code, 3);
    assert.match(refused.err, /records already have/);
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("the comment budget counts what is recorded and what is still reserved", () => {
  const agent = freshAgent((y) => y.replace("  x:\n    kind: comment\n", "  x:\n    kind: comment\n    comments_per_day: 2\n"));
  try {
    cli(agent, ["init"]);
    const post = (n: number) => ["--channel", "x", "--author", `@a${n}`, "--title", `post number ${n} about reviews`];
    assert.equal(json(cli(agent, ["budget", "--channel", "x", "--json"])).left, 2);
    cli(agent, ["reserve", ...post(1)]);
    cli(agent, ["reserve", ...post(2)]);
    const third = cli(agent, ["reserve", ...post(3)]);
    assert.equal(third.code, 4, "two reserved: the third is over budget");
    assert.match(third.err, /no comment budget left/);

    cli(agent, ["release", "--reservation", "r2"]);
    assert.equal(json(cli(agent, ["budget", "--channel", "x", "--json"])).left, 1, "a released reservation gives its slot back");
    cli(agent, ["record", "--reservation", "r1", "--outcome", "sent", ...post(1).slice(2)]);
    const b = json(cli(agent, ["budget", "--channel", "x", "--json"]));
    assert.equal(b.done, 1);
    assert.equal(b.left, 1);
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("a lead may be invited; anyone already contacted may not", () => {
  const agent = freshAgent();
  try {
    cli(agent, ["init"]);
    cli(agent, ["ledger", "add-lead", "--name", "Jane Doe", "--headline", "Head of Engineering"]);
    const r = json(cli(agent, ["reserve", "--channel", "linkedin", "--name", "Jane Doe", "--json"]));
    assert.equal(r.action, "invite", "a connect channel reserves an invite by default");
    cli(agent, ["record", "--reservation", String(r.reserved), "--outcome", "sent", "--name", "Jane Doe"]);
    assert.match(cli(agent, ["ledger", "list-people", "--stage", "Invited"]).out, /Jane Doe/, "the lead became Invited");

    cli(agent, ["ledger", "add-person", "--name", "Sam Roe"]);
    const refused = cli(agent, ["reserve", "--channel", "linkedin", "--name", "Sam Roe"]);
    assert.equal(refused.code, 3, "already invited");

    // Messages go to people the records have; the day's attempts bound them.
    const m = json(cli(agent, ["reserve", "--channel", "linkedin", "--action", "message", "--name", "Sam Roe", "--json"]));
    cli(agent, ["record", "--reservation", String(m.reserved), "--outcome", "sent", "--name", "Sam Roe"]);
    assert.match(cli(agent, ["ledger", "list-people", "--stage", "Warmup Sent"]).out, /Sam Roe/);

    assert.equal(cli(agent, ["reserve", "--channel", "linkedin", "--action", "comment", "--name", "x"]).code, 2, "a connect channel has no comments");
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("the report shows each channel's sends, failures and what is still open", () => {
  const agent = freshAgent();
  try {
    cli(agent, ["init"]);
    const a = ["--channel", "reddit", "--author", "u/one", "--title", "How do you split review load"];
    const b = ["--channel", "reddit", "--author", "u/two", "--title", "Our reviews take a week"];
    cli(agent, ["reserve", ...a]);
    cli(agent, ["reserve", ...b]);
    cli(agent, ["record", "--reservation", "r1", "--outcome", "failed", ...a.slice(2), "--comment", "draft kept"]);
    const rows = JSON.parse(cli(agent, ["report", "--json"]).out) as Array<Record<string, unknown>>;
    const reddit = rows.find((r) => r.channel === "reddit");
    assert.equal(reddit?.failed, 1);
    assert.deepEqual(reddit?.unsettled, ["r2 u/two: Our reviews take a week"]);
    assert.ok(rows.some((r) => r.channel === "linkedin" && r.action === "message"), "every action of every channel is listed");
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("records: in agent.yaml moves the records, relative to the agent folder", () => {
  const agent = freshAgent((y) => y.replace("records: null", "records: ../elsewhere"));
  try {
    cli(agent, ["init"]);
    assert.ok(existsSync(join(agent, "..", "elsewhere", "linkedin-outreach.md")));
  } finally {
    rmSync(join(agent, "..", "elsewhere"), { recursive: true, force: true });
    rmSync(agent, { recursive: true, force: true });
  }
});
