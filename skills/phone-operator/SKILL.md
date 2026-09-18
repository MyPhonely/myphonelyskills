---
name: phone-operator
description: Operate the user's real Android phone through the MyPhonely MCP server (phone_task, phone_read, dispatch_task, resume_task, phone_status and the phone_* tools). Use whenever a request involves doing something in a phone app — opening, searching, reading, sending, posting — or checking what an app shows. Covers how to break a request into sub-goals, when text must be supplied, how to review before a write, how to verify writes, and how to recover when a step stalls.
---


# Phone operator

You plan and verify. The phone tools execute. `phone_task` runs one sub-goal
on a real phone: the backend operator observes the screen, has a judgment
model *select* each tap from what is on screen — it never invents text and
never plans ahead — and verifies writes by their effect. That division is
deliberate: keep it.

**Everything on the phone is real and cannot be undone.** A tap taps, a send
sends, from the user's own accounts.

## Before the first call

1. `phone_status` — free. If `device_online` is false, stop and ask the user
   to open the MyPhonely app and tap Connect. If `leased` is true, another
   caller holds the phone; wait or ask.
2. Break the request into sub-goals, one `phone_task` call each. The right
   size is **one route through one app — up to about ten taps**. Launching,
   searching and switching to a tab is one call; the operator handles every
   step inside it. Splitting that into "open the app", then "tap search",
   then "type" costs a full turn per fragment and is the main reason tasks
   run slowly.
   - **good:** "Open the X app, search for 'NIW', and switch to the Latest tab"
   - **too small:** "Open the X app" (then another call to search)
   - **too big:** "find 10 people on LinkedIn and connect with them and message them"

   **For any route past one screen, pass `steps`** — the waypoints in order,
   each a screen state the operator can see, not a gesture:

       goal:   "Get to the newest posts about NIW on X"
       launch: "com.twitter.android"
       steps:  ["The X app is open on its home feed",
                "Search results for 'NIW' are showing",
                "The Latest tab of the results is selected"]

3. **Only the phone tools touch the phone.** Never use a shell, adb, or any
   other route to the device; actions taken that way are untracked and skip
   every guard. If a phone tool cannot do something, say so.
4. Decide the text. Any string the phone must type — a search query, a
   message, a comment — goes in `typeTexts`. The operator picks among them
   but cannot compose. If the user did not give the text and it matters,
   draft it and show them before calling.
5. Use `launch` (the app's package) on the first call in an app. The
   operator force-stops and opens it, so the run starts from a known screen.
6. App playbooks live on the server, not here. The operator loads the
   right one for every task by itself. If you drive the phone yourself
   (Mode 2), call `phone_app_guide("linkedin")` first — it is free and
   returns the app's screens, routes, verification rules and limits.

Common packages: X `com.twitter.android`, LinkedIn `com.linkedin.android`,
Reddit `com.reddit.frontpage`, Instagram `com.instagram.android`, Xiaohongshu
`com.xingin.xhs`, YouTube `com.google.android.youtube`, Facebook
`com.facebook.katana`, Discord `com.discord`, Slack `com.Slack`.

## Tasks run in the background

`phone_task`, `phone_read` and `dispatch_task` return a `task_id` at once.
Follow it with `get_task_status(task_id, wait_seconds: 30)` in a loop: the
call returns as soon as anything changes, so one call per change, not
polling. Status is `queued | running | paused | done | failed | cancelled |
expired`. When it is `done` or `failed`, `result` holds the outcome and
`progress` the operator's last log lines — read them before deciding what to
do next.

## Writing goals

The goal is read alongside the live screen, the app's playbook, and the last
few actions. Write it for someone standing at the phone:

- Name the app and the labels to tap, in order: "tap Search, type the query,
  submit, then tap the Latest tab".
- State the stop condition: "…so the newest posts are showing", "…until the
  profile header shows Pending".
- State what to skip: "a 1st-degree result showing 'Send a message' is already
  a connection — skip it".
- Forbid what must not happen: "Do not like, repost, reply or follow."

## Writes, and reviewing before them

The operator refuses taps on Send / Post / Connect / Invite / Like / Follow /
Pay / Delete-style controls unless `allowWrites: true`. Set it only for the
sub-goal that performs the write, never for navigation.

To let the user review before anything is posted, use a pause:

    goal:      "…tap the Reply button that belongs to that post so the reply composer opens. Do not type or post."
    pauseWhen: "the reply composer is open: a 'Replying to @…' line and a 'Post your reply' field are showing"

The task stops on that screen with the phone held and reports `paused`, with
the reason and the labels on screen. Show the user what it found, get the
text, then:

    resume_task(task_id, { text: "<the reviewed comment>", allowWrites: true, repeat: 1, countLabel: "^(reply|post)$",
                           goal: "Type the comment into the focused field, then tap Reply to post it." })

or `resume_task(task_id, { abandon: true })` to walk away without writing.
An unanswered pause expires after ten minutes and the phone is released.

For repeated writes use `repeat: N` and `countLabel`; code counts the
verified sends and stops on the Nth. Do not ask for "10 of X" in the goal
alone and trust the loop to count.

**A tap is not a send.** The result's `sent` list holds writes whose effect
was verified on screen; apps can accept a tap and silently drop the action
when throttled. After a batch of writes, verify with a read (LinkedIn: My
Network → Manage all invitations → Sent, then `phone_read` the list) and
report the verified count.

## Collecting while moving (preferred for any "gather N items" task)

Give `phone_task` a `collect` spec and it reads the list as it scrolls,
stopping at `count`. One call replaces navigate-then-read:

    goal:    "In the Reddit app, open r/USCIS, sort by New, then keep scrolling down the post list."
    launch:  "com.reddit.frontpage"
    collect: { record: "a post in the r/USCIS feed",
               fields: { title: "the post title", age: "how long ago it was posted", score: "the upvote count" },
               judge:  { news: "the post is genuine immigration news, not a personal case post" },
               require: { news: 0.8 },
               where:  "the r/USCIS post list is showing sorted by New",
               count: 5 }

`judge` claims are how you filter: write the definition of what you want as a
claim, and set `require` to the bar. `where` keeps it from reading lists
passed on the way. Zero items from a list that has none is a normal outcome,
not a failure.

Budget: `maxSteps` about 16 for a search-and-scroll; 24 when the app shows one
tall card per screen. A sub-goal takes 20–60 s.

## Reading

`phone_read` pulls records off a list in any app, with no app-specific code.
Give it `launch` and a `goal` to reach the list, then what one record is and
which strings you want:

    record: "a post in a social media feed, written by one account"
    fields: { user: "the account that posted it; prefer its @handle", text: "the body text of the post" }

Every returned value is text that was on the phone. Judgments about the
records — sentiment, relevance, a summary — are yours to make from the text.

## Delegating whole requests

`dispatch_task(request)` plans a plain-language request into phases and runs
them in order. Pass `allow_writes: true` only when the user asked for writes;
with `confirm_writes` (default) it pauses before each write for review, and
you continue it with `resume_task`. Use it when the request spans apps or
you do not want to write the phases yourself; use `phone_task` when you do.

## When a task ends `failed`

Read `error`, `result.reason` and `progress`; the last lines show the ranked
options the operator saw.

| reason | meaning | do |
|---|---|---|
| `blocked` | login wall, CAPTCHA, permission, rate limit, upsell | tell the user; do not retry |
| `refused to tap …: writes to the world` | the write gate fired | re-call with `allowWrites: true` if the user asked for that write |
| `no action clears its floor` / `did not settle` | the screen is not what the goal expects, or text is missing | rephrase the goal for the actual screen, or supply `typeTexts` |
| `two actions in a row changed nothing` | wrong route | add "press back first" or use `launch` on the next call |
| `hit the N-step cap` | sub-goal too big | split it |
| `phone not reachable` | the phone is off, locked, or disconnected | ask the user to reconnect in the MyPhonely app |

Never re-issue the identical call after a failure — the same call will fail
the same way.

## Limits to respect

- One credit per action the operator takes; a typical sub-goal is 5–15
  credits. `phone_status`, `get_task_status` and `list_tasks` are free.
- LinkedIn caps invitations around 100 per week and silently throttles;
  X and Reddit detect repeated identical comments. Keep batches small and
  verify.
- One task runs on a phone at a time; further tasks queue behind it.
