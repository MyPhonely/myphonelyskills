# MyPhonely skills

Skills for AI agents that operate a real Android phone through the
[MyPhonely](https://myphonely.ai) MCP server. Install them and your agent
knows both how to drive a phone and the use cases it can do end to end:
32 workflows across X, LinkedIn, Reddit, YouTube, Google Maps, Xiaohongshu,
Facebook, TikTok, WeChat and Google Play.

## Install

Paste this into your agent, with your api key from the MyPhonely dashboard:

```
Set up MyPhonely so you can operate my Android phone.

1. Add an MCP server named "myphonely": streamable HTTP, URL https://api.myphonely.ai/mcp,
   with the header "Authorization: Bearer YOUR_API_KEY". Put it in this tool's MCP config.
   (Claude Code: claude mcp add --transport http myphonely https://api.myphonely.ai/mcp --header "Authorization: Bearer YOUR_API_KEY")
2. Install the skills: clone https://github.com/MyPhonely/myphonelyskills and copy every folder
   under skills/ into your skills directory (Claude Code: ~/.claude/skills/, Cursor: .cursor/skills/,
   pi: a skills path in your package), or run: npx skills add MyPhonely/myphonelyskills
3. Call the phone_status tool. If device_online is false, tell me to open the MyPhonely app and tap Connect.
4. Read the server's instructions from the MCP initialize response before the first task.
   The phone is real and nothing can be undone; use only the phone tools, never adb or a shell.
Then tell me you are ready.
```

## What is here

```
skills/
  phone-operator/        how to plan, review, verify and recover with the phone tools
  <app>-<use-case>/      one workflow each: its inputs, and the calls that do it
CONTRIBUTING.md          how to write a workflow, and the rules that keep one honest
scripts/validate.mjs     check yours before opening a pull request
```

Every folder is a skill: a `SKILL.md` with frontmatter and guidance in the
body, the layout Claude Code, Cursor, pi and `npx skills` all read. There are
two kinds.

- **Teaching skills** shape how an agent uses the tools at all.
  `phone-operator` is the one to install first.
- **Workflows** are skills for a single use case, marked `kind: workflow`.
  Their frontmatter carries what the listing on myphonely.ai shows: the app,
  whether it writes, and whether it stops for your approval first. Their body
  is the procedure, with the exact calls and the inputs to fill in.

## Workflows

Read workflows collect records from a list and never touch anything. Write
workflows stop with the phone held at the point of no return, show you what
they are about to do, and continue only on `resume_task`.

| app | read | write, after you approve |
|---|---|---|
| X | collect posts about a topic · an account's recent posts · replies to a post | reply to a post · publish a post |
| LinkedIn | find people · one profile in detail · a person's recent posts · search posts by keyword · a company's employees · job postings | connection request with a note · publish a post |
| Reddit | posts from a subreddit · search posts · comments on a post | |
| YouTube | videos from a search · a channel's videos · comments on a video | |
| Google Maps | local businesses · a place's details · a place's reviews | |
| Xiaohongshu | notes from a search · a creator's notes · comments on a note | |
| Facebook | posts from a group you belong to · a page's recent posts | |
| Instagram | find accounts | |
| TikTok | videos from a search · comments on a video | |
| WeChat | an official account's articles | |
| Google Play | an app's reviews | |

Each listing says what has been run on a real phone and what has not. The
catalog at [myphonely.ai/workflows](https://www.myphonely.ai/workflows) is
built from these files and refreshes within minutes of a merge.

Per-app playbooks, the screens, routes, verification rules and limits for
each app, are not here. The server holds them: the operator loads the right
one for every task, and `phone_app_guide` returns them free to any caller
driving the phone directly.

## How MyPhonely works

Two ways to use the server, per goal:

- **Mode 1** — hand a goal to the operator: `phone_task` runs one route in
  one app; `phone_read` turns a list into records; `dispatch_task` plans a
  plain-language request into phases and runs them in order. Give
  `phone_task` a `pauseWhen` and it stops on that screen with the phone
  held, for you to review; `resume_task` continues it or abandons it. Poll
  with `get_task_status(task_id, wait_seconds)`, which returns as soon as
  anything changes.
- **Mode 2** — drive the phone yourself: `phone_app_guide` for the app's
  playbook first, `acquire_phone` for a lease so nothing else acts between
  your look and your tap, then `phone_screen`, `phone_tap_label`,
  `phone_type` and the other `phone_*` tools, and `release_phone` when done.

Every action costs one credit. The phone is the user's own, running their own
apps and signed into their own accounts: actions are real and cannot be
undone.

## Contributing

New workflows are the most useful thing to add. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the frontmatter, the shape of the body,
and the rules that keep a workflow honest, then run
`node scripts/validate.mjs` and run it on your own phone before opening the
pull request. Never include api keys, account names or private content.
Something you learned about an app itself, a screen, a route, a limit,
belongs in the server's playbooks: open an issue and we will fold it in.
