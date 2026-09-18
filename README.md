# MyPhonely skills

Skills and playbooks for AI agents that operate a real Android phone through
the [MyPhonely](https://myphonely.ai) MCP server. Install them into your
agent (Claude Code, pi, Cursor, or any agent with a skills directory) so it
plans phone work well from the first request.

## Install

Paste this into your agent, with your api key from the MyPhonely dashboard:

```
Set up MyPhonely so you can operate my Android phone.

1. Add an MCP server named "myphonely": streamable HTTP, URL https://api.myphonely.ai/mcp,
   with the header "Authorization: Bearer YOUR_API_KEY". Put it in this tool's MCP config.
   (Claude Code: claude mcp add --transport http myphonely https://api.myphonely.ai/mcp --header "Authorization: Bearer YOUR_API_KEY")
2. Install the skills: clone https://github.com/MyPhonely/myphonelyskills and copy skills/phone-operator
   into your skills directory (Claude Code: ~/.claude/skills/, Cursor: .cursor/skills/,
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
workflows/
  find-review-reply.md   find a post, pause for the user's comment, post it
  collect-feed.md        read N posts about a topic with authors, filtered by a claim
```

Per-app playbooks (screens, routes, verification rules, limits for X,
LinkedIn, Reddit, Instagram, Xiaohongshu and more) are served by the MCP
server itself: the operator loads them for every task, and `phone_app_guide`
returns them free to any caller driving the phone directly.

Each skill is a `SKILL.md` with frontmatter (`name`, `description`) and the
guidance in the body, the layout Claude Code, pi and `npx skills` all read.

## How MyPhonely works

Two ways to use the server, per goal:

- **Mode 1** — hand a goal to the operator: `phone_task` (one route in one
  app, may pause for review), `phone_read` (a list into records),
  `dispatch_task` (plain language, planned into phases). Follow with
  `get_task_status(task_id, wait_seconds)`; answer a pause with
  `resume_task`.
- **Mode 2** — drive the phone yourself with `phone_screen`,
  `phone_tap_label`, `phone_type` and the other `phone_*` tools under a lease
  from `acquire_phone`.

Every action costs one credit. The phone is the user's own, running their
own apps and accounts: actions are real.

## Contributing

Workflows and improvements to the operator skill are welcome as pull
requests. Never include api keys, account names or private content in an
example. Something you learned about an app on a real device — a screen, a
route, a limit — belongs in the server's playbooks: open an issue and we
will fold it in.
