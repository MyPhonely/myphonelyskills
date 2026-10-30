import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    assert.deepEqual(show.also_read, [], "nothing else in the example");
    writeFileSync(join(agent, "links.md"), "# links\n");
    writeFileSync(join(agent, "README.md"), "# for people\n");
    assert.deepEqual(json(cli(agent, ["show", "--json"])).also_read, [join(agent, "links.md")], "other .md files are read; README.md is not");
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

    const rec = json(cli(agent, ["record", "--reservation", "r1", "--outcome", "sent", ...post.slice(2), "--comment", "Nice.", "--json"]));
    assert.equal(rec.outcome, "sent", "record prints one JSON result");
    assert.equal(cli(agent, ["check", ...post]).code, 0, "the records have it now");
    assert.equal(cli(agent, ["record", "--reservation", "r1", "--outcome", "sent", ...post.slice(2)]).code, 2, "settled once");

    // A different read of the same post, by its URL.
    const same = ["--channel", "x", "--author", "@dev", "--title", "other words", "--url", "https://twitter.com/dev/status/1?s=20"];
    const refused = cli(agent, ["reserve", ...same]);
    assert.equal(refused.code, 3);
    assert.match(refused.err, /already reserved today/, "the two URL shapes are one reservation");
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

test("drafts: queued for review, approved or skipped by the user, then settled in place when sent", () => {
  const agent = freshAgent();
  try {
    cli(agent, ["init"]);
    const post = ["--channel", "x", "--author", "@dev", "--title", "Our review queue is a week long", "--url", "https://x.com/dev/status/7"];
    const d = json(cli(agent, ["draft", ...post, "--comment", "First draft.", "--json"]));
    assert.equal(d.status, "Pending Review");
    assert.equal(cli(agent, ["draft", ...post, "--comment", "again"]).code, 3, "one draft per post");

    const other = ["--channel", "x", "--author", "@two", "--title", "Reviews are slow here too"];
    const d2 = json(cli(agent, ["draft", ...other, "--comment", "Second.", "--json"]));
    cli(agent, ["mark", "--line", String(d2.drafted), "--status", "Skipped"]);

    cli(agent, ["mark", "--line", String(d.drafted), "--status", "Approved", "--comment", "Edited by the user."]);
    const approved = JSON.parse(cli(agent, ["drafts", "--status", "Approved", "--json"]).out) as Array<Record<string, string>>;
    assert.equal(approved.length, 1);
    assert.equal(approved[0].comment, "Edited by the user.");
    assert.equal(JSON.parse(cli(agent, ["drafts", "--json"]).out).length, 1, "a skipped draft is no longer waiting");

    // The next run posts it: reserve, write, record.
    const r = json(cli(agent, ["reserve", ...post, "--json"]));
    cli(agent, ["record", "--reservation", String(r.reserved), "--outcome", "sent", ...post.slice(2), "--comment", "Edited by the user."]);
    assert.equal(JSON.parse(cli(agent, ["drafts", "--json"]).out).length, 0, "nothing waiting");
    const queue = execFileSync("cat", [join(agent, "records", "social-outreach-queue.md")], { encoding: "utf8" });
    assert.equal(queue.split("\n").filter((l) => l.startsWith("Commented |")).length, 1, "the draft's own row became Commented; no second row");
    assert.equal(cli(agent, ["draft", ...post, "--comment", "x"]).code, 3, "a post already commented cannot be drafted");
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("new writes a folder from the templates, never over one, and lint says what is left", () => {
  const root = mkdtempSync(join(tmpdir(), "new-"));
  const dir = join(root, "acme");
  try {
    const env = { ...process.env };
    delete env.OUTREACH_AGENT;
    const run = (args: string[]) => {
      try {
        return { code: 0, out: execFileSync(process.execPath, [CLI, ...args], { encoding: "utf8", env, stdio: "pipe" }) };
      } catch (error) {
        const e = error as { status?: number; stdout?: string };
        return { code: e.status ?? 1, out: e.stdout ?? "" };
      }
    };
    assert.equal(run(["new", "--dir", dir, "--id", "acme", "--site", "acme.dev"]).code, 0);
    assert.ok(existsSync(join(dir, ".gitignore")), "records stay out of git by default");
    assert.equal(run(["new", "--dir", dir, "--id", "acme"]).code, 2, "never overwrites");
    const fresh = run(["lint", "--agent", dir]);
    assert.equal(fresh.code, 1);
    assert.match(fresh.out, /CHANGEME .*agent\.yaml/);
    assert.match(fresh.out, /not ready/);

    // The example is a finished agent.
    const example = run(["lint", "--agent", join(SCRIPTS, "..", "example")]);
    assert.equal(example.code, 0, example.out);
    assert.match(example.out, /^ready$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("check accepts --agent before the command, as targets does", () => {
  const agent = freshAgent();
  try {
    cli(agent, ["init"]);
    const env = { ...process.env };
    delete env.OUTREACH_STATE;
    delete env.OUTREACH_AGENT;
    let code = 0;
    let out = "";
    let err = "";
    try {
      out = execFileSync(process.execPath, [CLI, "--agent", agent, "check", "--channel", "x", "--author", "a", "--title", "a long enough title"], {
        encoding: "utf8",
        env,
        stdio: "pipe",
      });
    } catch (error) {
      const e = error as { status?: number; stdout?: string; stderr?: string };
      code = e.status ?? 1;
      out = e.stdout ?? "";
      err = e.stderr ?? "";
    }
    assert.equal(code, 1, err);
    assert.match(out, /found: false/);
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("asking for a firm is not promo, and a missed follow may be released and retried once", () => {
  const agent = freshAgent((y) =>
    y.replace("order: [linkedin, x, reddit]", "order: [linkedin, x, reddit, xiaohongshu]").replace(
      "\noffer:",
      `
  xiaohongshu:
    kind: engage
    follows_per_day: 5
    keywords: [alpha]

offer:`,
    ),
  );
  try {
    cli(agent, ["init"]);
    const ask = json(
      cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小王", "--title", "批了", "--body", "求律所推荐，求律师", "--json"]),
    );
    assert.equal(ask.reserved, "r1", "律所 and 律师 in a comment are the audience");
    assert.equal(cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "某律所", "--title", "批了"]).code, 3);
    assert.equal(cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小李", "--title", "批了", "--body", "欢迎咨询"]).code, 3);

    cli(agent, ["release", "--reservation", "r1"]);
    assert.equal(json(cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小王", "--title", "批了", "--json"])).reserved, "r2");
    cli(agent, ["release", "--reservation", "r2"]);
    const third = cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小王", "--title", "批了"]);
    assert.equal(third.code, 3);
    assert.match(third.err, /one retry/);

    const missed = json(cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小赵", "--title", "批了", "--json"]));
    cli(agent, ["record", "--reservation", String(missed.reserved), "--outcome", "failed", "--name", "小赵", "--title", "批了"]);
    assert.equal(cli(agent, ["release", "--reservation", String(missed.reserved)]).code, 0, "a recorded miss can be given back");
    const again = json(cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小赵", "--title", "批了", "--json"]));
    assert.equal(again.action, "follow");
    assert.equal(
      cli(agent, ["record", "--reservation", String(again.reserved), "--outcome", "sent", "--name", "小赵", "--title", "批了", "--note", "求律所推荐"]).code,
      0,
    );
    assert.match(readFileSync(join(agent, "records", "engaged.md"), "utf8"), /求律所推荐/);
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});

test("an engage channel follows commenters and likes their notes, never comments, and dedups by person and note id", () => {
  const agent = freshAgent((y) =>
    y.replace("order: [linkedin, x, reddit]", "order: [linkedin, x, reddit, xiaohongshu]").replace(
      "\noffer:",
      `
  xiaohongshu:
    kind: engage
    lang: zh
    posts_per_keyword: 2
    follows_per_day: 2
    keywords: [alpha topic, beta topic]

offer:`,
    ),
  );
  const noteA = "64f1aabbccddeeff00112233";
  const noteB = "64f1aabbccddeeff00112244";
  const noteC = "64f1aabbccddeeff00112255";
  try {
    cli(agent, ["init"]);
    assert.ok(existsSync(join(agent, "records", "engaged.md")));
    const plan = json(cli(agent, ["targets", "--channel", "xhs", "--json"]));
    assert.equal(plan.kind, "engage");
    assert.equal(plan.audience, "commenters");
    assert.equal(plan.comment, false);
    assert.equal(plan.dm, false);
    assert.equal(plan.follow_author, false);
    assert.equal(plan.like_source, false);
    assert.equal(plan.follow_commenters, true);
    assert.equal(plan.commenters_per_post, 3);
    assert.equal(plan.follows_per_day, 2);
    assert.equal(plan.likes_per_day, 2, "likes match follows unless set");
    assert.equal(plan.sort, "latest");
    assert.deepEqual(plan.skip_names_containing, ["中介", "移民", "律师", "律所", "咨询", "办理", "代办", "移民公司", "私信"]);
    assert.deepEqual(plan.skip_text_containing, ["欢迎咨询", "中介", "代办", "移民公司", "私信", "办理"]);
    const dispatches = plan.dispatches as Array<{ keyword: string; posts: number }>;
    assert.deepEqual(
      dispatches.map((d) => [d.keyword, d.posts]),
      [["alpha topic", 1]],
      "one source note covers commenters_per_post follows, so the follow budget opens one note",
    );

    const commented = cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "comment", "--author", "a", "--title", "t"]);
    assert.equal(commented.code, 2, "an engage channel never comments");
    assert.match(commented.err, /follow or like/);
    assert.equal(cli(agent, ["draft", "--channel", "xiaohongshu", "--author", "a", "--title", "t", "--comment", "hi"]).code, 2);

    const firm = cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "示例咨询", "--title", "source note"]);
    assert.equal(firm.code, 3, "a firm-like name is not a commenter");
    assert.match(firm.err, /咨询/);
    const promoNote = cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小王", "--title", "欢迎咨询办理"]);
    assert.equal(promoNote.code, 3, "a promo title is not a note to engage");
    const promoBody = cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小王", "--title", "a normal note", "--body", "私信我，代办"]);
    assert.equal(promoBody.code, 3, "promo wording in the body is refused");
    assert.equal(json(cli(agent, ["budget", "--channel", "xiaohongshu", "--action", "follow", "--json"])).left, 2, "a promo refusal takes no budget");
    assert.equal(
      cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "like", "--author", "某律师", "--title", "their latest note", "--url", noteB]).code,
      3,
    );
    assert.equal(json(cli(agent, ["budget", "--channel", "xiaohongshu", "--action", "follow", "--json"])).left, 2, "a refusal takes no budget");

    const followAlice = json(cli(agent, ["reserve", "--channel", "xiaohongshu", "--name", "Alice", "--title", "source note", "--json"]));
    assert.equal(followAlice.action, "follow", "follow is the default; a bare reserve does not like the source note");
    assert.equal(
      cli(agent, ["record", "--reservation", "r1", "--outcome", "sent", "--channel", "xhs", "--name", "Alice", "--url", "user:10000000001"]).code,
      0,
      "--channel is accepted and matched to the reservation",
    );
    assert.equal(cli(agent, ["check", "--channel", "xiaohongshu", "--action", "follow", "--name", "@ALICE"]).code, 0, "@ and case are one person");
    assert.equal(
      cli(agent, ["check", "--channel", "xiaohongshu", "--action", "follow", "--name", "Someone Else", "--url", "user:10000000001"]).code,
      0,
      "the same profile id is the same person",
    );

    const followWang = json(cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小王", "--title", "source note", "--json"]));
    const wrong = cli(agent, ["record", "--reservation", String(followWang.reserved), "--outcome", "sent", "--channel", "linkedin", "--name", "小王"]);
    assert.equal(wrong.code, 2);
    assert.match(wrong.err, /does not match/);
    assert.equal(cli(agent, ["record", "--reservation", String(followWang.reserved), "--outcome", "sent", "--channel", "xiaohongshu", "--name", "小王"]).code, 0);
    const over = cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "follow", "--name", "小赵", "--title", "source note"]);
    assert.equal(over.code, 4, "follows_per_day is one pool for every commenter");
    assert.match(over.err, /no follow budget/);

    const title = "their latest note about the move";
    const likeA = json(
      cli(agent, [
        "reserve",
        "--channel",
        "xiaohongshu",
        "--action",
        "like",
        "--author",
        "小王",
        "--title",
        "怎么选律师的经历分享",
        "--url",
        `https://www.xiaohongshu.com/explore/${noteA}`,
        "--json",
      ]),
    );
    assert.equal(likeA.action, "like", "律师 in the note title is not a firm name");
    assert.equal(
      cli(agent, [
        "record",
        "--reservation",
        String(likeA.reserved),
        "--outcome",
        "sent",
        "--channel",
        "xiaohongshu",
        "--author",
        "小王",
        "--title",
        title,
        "--url",
        `https://www.xiaohongshu.com/discovery/item/${noteA}?xsec_token=abc`,
      ]).code,
      0,
    );
    assert.equal(
      cli(agent, ["check", "--channel", "xiaohongshu", "--action", "like", "--author", "别的读法", "--title", "completely different words", "--url", noteA]).code,
      0,
      "explore, discovery/item and a bare id are one note",
    );
    const likeB = json(
      cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "like", "--author", "小王", "--title", title, "--url", noteB, "--json"]),
    );
    assert.equal(cli(agent, ["record", "--reservation", String(likeB.reserved), "--outcome", "sent", "--author", "小王", "--title", title, "--url", noteB]).code, 0);
    assert.equal(
      cli(agent, ["check", "--channel", "xiaohongshu", "--action", "like", "--author", "小王", "--title", title, "--url", noteC]).code,
      1,
      "a different note id is not the same like, even with the same title",
    );
    const likeOver = cli(agent, ["reserve", "--channel", "xiaohongshu", "--action", "like", "--author", "小李", "--title", "another note entirely", "--url", noteC]);
    assert.equal(likeOver.code, 4);
    assert.match(likeOver.err, /no like budget/);

    const rows = json(cli(agent, ["report", "--json"])) as unknown as Array<Record<string, unknown>>;
    const xhs = rows.filter((r) => r.channel === "xiaohongshu").map((r) => `${r.action}:${r.sent}`);
    assert.deepEqual(xhs, ["follow:2", "like:2"]);
  } finally {
    rmSync(agent, { recursive: true, force: true });
  }
});
