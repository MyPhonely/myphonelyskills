# MyPhonely skills

Skills for AI agents that operate a real Android phone through the
[MyPhonely](https://myphonely.ai) MCP server. Install them and your agent
knows both how to drive a phone and the use cases it can do end to end.

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
  x-collect-topic/       one use case each: its inputs, and the calls that do it
  x-find-review-reply/
CONTRIBUTING.md          how to write one
scripts/validate.mjs     check yours before opening a pull request
```

Every folder is a skill: a `SKILL.md` with frontmatter and guidance in the
body, the layout Claude Code, Cursor, pi and `npx skills` all read. There are
two kinds.

- **Teaching skills** shape how an agent uses the tools at all.
  `phone-operator` is the one to install first.
- **Workflows** are skills for a single use case, marked `kind: workflow`.
  Their frontmatter carries what the listing on myphonely.ai shows: the app,
  the credit range, whether it writes, and whether it stops for your approval
  first. Their body is the procedure, with the exact calls.

Per-app playbooks, the screens, routes, verification rules and limits for X,
LinkedIn, Reddit, Instagram, Xiaohongshu and more, are not here. The server
holds them: the operator loads the right one for every task, and
`phone_app_guide` returns them free to any caller driving the phone directly.

## How MyPhonely works

Two ways to use the server, per goal:

- **Mode 1** — hand a goal to the operator: `phone_task` (one route in one
  app, and it can pause for your approval), `phone_read` (a list into
  records), `dispatch_task` (plain language, planned into phases). Follow with
  `get_task_status(task_id, wait_seconds)`; answer a pause with `resume_task`.
- **Mode 2** — drive the phone yourself with `phone_screen`,
  `phone_tap_label`, `phone_type` and the other `phone_*` tools, under a lease
  from `acquire_phone`.

Every action costs one credit. The phone is the user's own, running their own
apps and signed into their own accounts: actions are real and cannot be
undone.

## Contributing

New workflows are the most useful thing to add. See
[CONTRIBUTING.md](CONTRIBUTING.md) for the frontmatter, the shape of the body,
and the rules that keep a workflow honest, then run
`node scripts/validate.mjs`. Never include api keys, account names or private
content. Something you learned about an app itself, a screen, a route, a
limit, belongs in the server's playbooks: open an issue and we will fold it
in.
