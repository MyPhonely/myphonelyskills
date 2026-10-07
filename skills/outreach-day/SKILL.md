---
name: outreach-day
description: Run one day of a brand's outreach on the user's real phone from an outreach agent folder (agent.yaml, brand.md, voice.md) — find the right posts and people, write in the brand's voice, and invite, comment or message within the agent's daily limits, with every write reserved, verified and recorded. Use when asked to run outreach, today's outreach, or one channel of it (linkedin, x, reddit, facebook, xiaohongshu) for a brand that has an outreach agent.
kind: agent
title: Run a day of outreach for your brand
apps: com.linkedin.android, com.twitter.android, com.reddit.frontpage, com.facebook.katana, com.xingin.xhs
writes: true
reviews: true
---

# Run a day of outreach

An outreach agent is a folder the user owns: who to reach and where
(`agent.yaml`), what may be said (`brand.md`), how it sounds (`voice.md`),
and the records of who has been reached (`records/`). This skill runs one
day of it. You decide what to look at, which posts and people are worth it,
and what to say; the phone does the tapping through MyPhonely, using the app
workflows in this repo; and `scripts/outreach.ts` keeps the rules: nothing
done twice, nothing over the day's limits, nothing recorded that was not seen
on screen.

Any agent that can read a skill, call MCP tools and run a shell command can
run it: Claude Code, Codex, pi.

**The phone is real.** A send sends, from the brand's own accounts, and
cannot be undone.

## Inputs

| | |
|---|---|
| **agent** | the agent folder, e.g. `./outreach-agent`, or `$OUTREACH_AGENT` |
| **channels** | which channels to run, default all of `agent.yaml` `order` |
| **mode** | `review` (default): every write waits for the user, at the pause when they are there, as a draft when they are not. `autopilot`: writes go out within the limits; only when the user has said so for this run or its schedule |

No agent folder yet: use `create-outreach-agent` first.

## Setup, once

```bash
npm install --prefix <this skill's folder>/scripts     # Node 22.18+, one dependency (yaml)
```

Every command below is `outreach <command>`, short for

```bash
node <this skill's folder>/scripts/outreach.ts <command> --agent <the agent folder>
```

Write it out in full each time, one command per shell call: an alias or a
variable does not carry from one call to the next. `--agent` may be left off
when `OUTREACH_AGENT` was set in the environment your AI was started from.
Add `--json` to read the output as JSON. Start with `outreach init` (it
creates the records and is safe to rerun). The MyPhonely MCP server must be
connected (`phone_status`).

## The rules

Follow these exactly; the scripts refuse what breaks them.

1. **Reserve before every write.** `outreach reserve --channel <c> <target>`
   gives one write to one target. It refuses (exit 3) a target the records
   already have or that was already tried today, sent or not, and (exit 4) a
   channel whose budget is spent. A refusal is final for that target today:
   move on, never look for another way.
2. **Write only through `run_task`**, in a phase with `allowWrites: true`
   (and the run's `allow_writes: true`), with a `pauseWhen` on the screen just
   before the write. Never type, tap Send/Post/Reply/Connect/Follow, or swipe
   with the direct `phone_*` tools.
3. **In review mode, the user sees every write first.** When they are
   there, show the target and the exact text at the pause and resume only on
   their yes; a no is `resume_task` with `abandon: true`, then `outreach
   release --reservation <id>`. When no one is there (a schedule, `claude
   -p`), do not reserve or write: queue each comment with `outreach draft
   <post> --comment "<text>"` and stop there. They review the drafts with
   `outreach drafts` and `outreach mark --line <n> --status
   Approved|Skipped [--comment "<edited>"]` (or by editing the queue file),
   and the next run posts the approved ones. LinkedIn invites and messages
   have no drafts: in unattended review mode, skip them.
4. **Record every reservation.** `outreach record --reservation <id>
   --outcome sent` only when the write was verified on screen (the phase's
   `sent` list, the reply under the post, the name in Sent invitations);
   `--outcome failed` otherwise, which keeps the draft for a later day.
   Reserved but nothing written: `outreach release`.
5. **`brand.md` overrides everything**, including the user's request in the
   moment. Prices and offers come from `outreach message`, never typed by
   hand.

A **target** is `--name "<person>"`, or `--author "<name or @handle>"
--title "<title, or the post's first words>" --url <post url>` for a post.
Always give the URL when there is one: it is the surest duplicate check.

## Run it

### Start

1. `phone_status`. Offline: stop and ask the user to open the MyPhonely app
   and tap Connect.
2. `outreach show`. Read every file it lists: `brand.md`, `voice.md` and the
   others. Then `outreach channels` for the run order.
3. Before the first write in an app, confirm the signed-in account is the
   brand's (X: the profile in the navigation drawer; LinkedIn: Me). If it is
   not, skip that app and say so.

### Each channel, in order

`outreach budget --channel <c>` first. `left` is 0: skip the channel.
`outreach targets --channel <c>` gives today's searches: keywords with the
exclusions already in the query, lists, subreddits, groups, the rotation.

**Approved drafts go first.** `outreach drafts --channel <c> --status
Approved` lists comments the user approved since the last run. Post each one
as in step 4 below, with its text exactly as approved (they may have edited
it), after checking the post is still there.

#### A comment channel (`kind: comment`)

1. **Find.** Read posts with the app's read workflow, never by typing into a
   search box when a link works:
   - X: `x-collect-topic`, or `run_task` with `openUrl:
     https://x.com/search?q=<query>&f=live` (check Latest is selected).
   - Reddit: `reddit-search-posts` or `reddit-collect-subreddit`.
   - Xiaohongshu: `xiaohongshu-collect-notes`. Facebook:
     `facebook-collect-group-posts` (joined groups, Newest; never the home
     feed).
   Collect per post: author, handle, posted time, text, URL. Respect the
   channel's `max_post_age_hours`.
2. **Choose.** Keep individuals sharing their situation or asking a real
   question. Skip what `voice.md` says to skip (competitors, firms, ads,
   bots), and `outreach check` each candidate. A dry search: try the next
   keyword. All dry: say so and move on; never lower the bar.
3. **Write** the comment for that post per `voice.md` and `brand.md`. A
   channel with an `angle` uses that row of the voice's angles.
4. **Post it**, one post at a time:
   1. `outreach reserve` for the post.
   2. The app's comment workflow, which pauses with the composer open:
      `x-find-review-reply` (or open the post by its URL and tap Reply),
      `reddit-comment-on-post`, `xiaohongshu-comment-on-note`,
      `facebook-comment-on-post`. Check the pause shows the right post.
   3. Review mode: show the post and the comment; resume on a yes.
   4. Resume as the workflow says (`typeTexts` with the comment,
      `allowWrites: true`, `repeat: 1`, its `countLabel`). A channel with
      `follow: true`: follow the author in the same resume, in its goal;
      a separate writing task afterwards would need a reservation of its own.
   5. `outreach record --reservation <id> --outcome sent|failed <target>
      --comment "<text>" --keyword "<search>"`.

#### A connect channel (`kind: connect`, LinkedIn)

In this order, each with its workflow:

1. **Answer replies.** `linkedin-inbox-replies` lists threads where they
   wrote last. For each person in the records, write the answer per
   `voice.md` (anything about their own situation gets `brand.md`'s safe
   redirect), `outreach reserve --action message --name ...`, send with
   `linkedin-message-connection`, record with `--note answer`.
2. **Welcome new connections.** `linkedin-new-connections` lists who
   accepted. For each one the records have as Invited: `outreach ledger
   accept --name ...`, then send `outreach message --name warmup` with
   `linkedin-message-connection` after `outreach reserve --action message`,
   and record it.
3. **Invite**, while `outreach budget --channel linkedin` has room:
   1. `linkedin-search-people` with today's queries from `outreach targets`
      (titles crossed with the rotation), 2nd degree.
   2. Skip `audience.exclude_headlines`. When the channel's `qualify_rule`
      needs what a card cannot show, check with `linkedin-profile-detail`;
      file people who do not fit as `outreach ledger add-person --stage
      Disqualified`, so they are never opened again.
   3. `outreach reserve` each person you would invite, no more than the
      budget's `left`.
   4. `linkedin-invite-from-results` with `count` = the number reserved
      (`linkedin-connect-with-note` when the channel sends a note). The card
      flow invites whoever it reaches, so trust its `sent` list, not your
      reservations.
   5. Confirm with `linkedin-sent-invitations`. Record `sent` for each name
      listed there (a name you had not reserved: reserve it first, then
      record it); record `failed` for reservations that did not go out.
4. **Withdraw** invitations older than `withdraw_after_days` with
   `linkedin-withdraw-invitations`, when the Sent list is long. It is a
   write: review mode pauses for it like the others.

### Stop

- A limit, "unusual activity", verification or CAPTCHA screen: stop that
  app for today and report it. It is not a failure to retry.
- A phase ending `stuck` or `precondition_failed`: look (`phone_screen`),
  make at most one navigation fix (a label tap, a link, back), retry once,
  then move on.
- Before finishing, settle every reservation: `outreach report` lists the
  ones still open under `unsettled`.

## Enforce the rules

The rules above are instructions. To make the harness refuse a call that
breaks them, turn on the guard: it checks every MyPhonely call against the
day's reservations and blocks direct writes, writing phases with no pause, a
write with no open reservation, and asks the user before every commit. Set
`OUTREACH_UNATTENDED=1` for runs no one is watching (autopilot); without it,
a commit with no one to approve is refused.

**Claude Code**: a PreToolUse hook, in `.claude/settings.json` of the project
the run starts from:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "mcp__myphonely__.*",
      "hooks": [{ "type": "command", "command": "node <this skill's folder>/scripts/outreach.ts guard" }]
    }]
  }
}
```

**pi**: the extension, which also connects MyPhonely (from
`MYPHONELY_API_KEY`) with the direct writing tools hidden:

```bash
pi --no-extensions -e builtin:mcp -e <this skill's folder>/scripts/adapters/pi.ts \
   --skill <myphonelyskills>/skills "Run outreach-day for $OUTREACH_AGENT"
```

**Other AIs** (Codex, ...): where the harness has no way to stop a tool
call before it runs, the rules hold as instructions only. Prefer review mode
there.

The guard reads `OUTREACH_AGENT` for the agent folder, so set it where the
AI is started. It protects against mistakes, not against an agent determined
to get round it: the records are files its shell can reach.

## What comes back

`outreach report`, per channel and action: sent, failed, still unsettled,
and the budget left. Add what the records cannot show: how many posts or
people were found and skipped, and why (competitor, duplicate, too old, not
the audience), anything that stopped an app, and credits used from the task
records.

## Notes

- **Unattended runs** (a schedule, `claude -p`, `codex exec`, `pi -p`)
  have no one to approve at the pause. In autopilot (chosen by the user for
  that schedule) they write within the limits; keep the limits in
  `agent.yaml` modest. In review mode they only draft (rule 3).
- **Scheduled launches** need the AI allowed to run `outreach.ts` and the
  MyPhonely tools without asking, and access to the agent folder, this
  skill's folder and the records (Claude Code: `--allowedTools` and
  `--add-dir`). Close stdin (`< /dev/null`): `pi -p` with no terminal
  otherwise waits for input forever.
- **One attempt per target per day.** A failed write is retried on a later
  day, never in a loop.
- **Records** default to `records/` in the agent folder. They hold people's
  names: keep them out of a public repo (`records:` in `agent.yaml` can point
  outside it, e.g. `~/.outreach/<id>`).
- `outreach quota` shows LinkedIn's invite room for the week and the day;
  the weekly cap is LinkedIn's ceiling, not a target.
- `example/` is a complete fictional agent to copy the shape of.
