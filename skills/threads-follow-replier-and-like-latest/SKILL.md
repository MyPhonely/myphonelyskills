---
name: threads-follow-replier-and-like-latest
description: Search Threads once, open one recent post, then follow one person who replied and, as a separate step, like one of their posts. Use when outreach should reach people who replied under a topic, without replying, reposting, quoting, messaging, following the author, or liking the source post.
kind: workflow
title: Follow Threads repliers and like their latest post
apps: com.instagram.barcelona
writes: true
reviews: true
---

# Follow Threads repliers and like their latest post

Searches Threads once and opens one recent post by its text or media. The
people who replied under that post are the audience. Each one is two short
writes: follow them, and only then like one of their own posts. The source
post is not liked and its author is not followed. Nothing is replied,
reposted, quoted, messaged or posted.

Stay inside the app. Do not open a profile URL. `resume_task` with
`abandon: true` presses Back once as it leaves. After an abandon, look at
the screen before you press Back yourself.

This route has not been run on a phone. The notification dialog and the
Profile tab are known from opening Threads: confirm them, and the rest of
the route, on a device before trusting a count.

## Leases

`phone_status` before the first call. If `leased` is true, that hold belongs
to someone else. Do not pass their `lease_id` to `phone_screen`,
`phone_screenshot`, or any other tool, and do not `release_phone` it. Poll
`phone_status` until `leased` is false. Cap the wait at six polls, then stop
this run. `acquire_phone` only for a short read, never while a `run_task` is
queued or running, and `release_phone` that id as soon as the read returns.
A lease you still hold blocks the task. Do not leave it to expire. The only
`lease_id` you may pass is one `acquire_phone` just returned to you.

## Polling

After every `run_task` and `resume_task`, poll
`get_task_status(task_id, wait_seconds: 30)` and **stop on the first**
status of `paused`, `done`, `failed`, `cancelled` or `expired`. Do not
wait only for `done`. A paused task is not still running: stop polling it.
Cap the wait at six polls (about three minutes), then use the last status.
On `paused`, the next call is `resume_task` on that same `task_id`, or
`abandon: true` if you are leaving it. Do not start a new `run_task` while
a task is paused; it queues behind the paused one and the screen is held.
On `failed`, do not poll again and do not repeat the same call.

## Inputs

| | |
|---|---|
| **account** | the handle that must be signed in, e.g. `@quickfiling`. Compared with the Profile tab, ignoring case and a leading @. No account: stop |
| **query** | one search keyword, not a post title, e.g. `NIW approved` |
| **name** | one replier's name, chosen at the pause, e.g. `Mina Chen` |

One name per follow, and one name per like.

## Run it

**1. Open Threads and read who is signed in.** Nothing is written. `launch`
is only on this call. If no `account` was given, stop before this call.

```json
run_task({
  "phases": [{
    "launch": "com.instagram.barcelona",
    "goal": "Open the Threads app. If a dialog asks 'Allow Threads to send you notifications?', tap Don't allow. Do not tap Allow. Then tap Profile at the bottom right of the screen. Stop when that profile is open and the signed-in username is visible. Do not search. Do not tap Follow, Like, Reply, Repost or the composer.",
    "pauseWhen": "the signed-in Threads profile is open and its username is on screen",
    "pauseScreenshot": true,
    "maxSteps": 8
  }]
})
```

Stop polling when status is `paused`. Read the username. It matches
`account` only when the handle is the same, ignoring case and a leading @.
Anything else: `resume_task` with `abandon: true`, say which account was
showing, and stop. Do not search and do not follow.

**2. Search once and open one post so a reply is on screen.** The profile
task is paused and the account matched. Resume it. No second `launch`. If
a Recent or Latest chip is already on the results, tap it. If it is not on
screen, do not open menus looking for it. Open the post by tapping its
text or its picture. Do not tap the author's name or avatar: that opens
their profile, and the author is not the audience.

```json
resume_task({
  "task_id": "<id>",
  "goal": "In the Threads app, tap Search in the bottom bar, tap the search field, type '<query>', and submit the search. This is a keyword search, not a post title. Do not read the home feed. Do not open a link or Chrome. If a chip labelled Recent or Latest is already visible, tap it once. If it is not visible, leave the results as they are. Skip a post whose author is <account>. Open one post by tapping its text or its picture, and nothing else on that card. Do not tap the author's name or avatar. If that tap does not open the post, stop. On the post, scroll until one reply row is actually on screen, the replier's name and their reply text both visible. Do not tap Follow, Like, Reply, Repost, Quote or the heart. Do not like the post you just opened.",
  "typeTexts": ["<query>"],
  "pauseWhen": "a Threads post from the '<query>' search is open, and a reply row is on screen with the replier's name and the reply text",
  "pauseScreenshot": true,
  "maxSteps": 18
})
```

Stop polling when status is `paused`. Read the age, the post text, and
each reply that is on screen: the replier's name and the reply next to it.
Keep that reply text. You will need it before you open their profile.
Reserve nothing before that. A reply that is below the fold is not a row
you can tap. If you need it, this task has to scroll it on screen first.
`phone_scroll` only after this task has finished or been abandoned, and
only with a lease you release before the next task. `phone_swipe` is
refused.

**3. Choose one name.** Skip the author, the signed-in account, and an
agency, law firm or promoter. Skip a name or a bio that contains lawyer,
attorney, law firm, immigration consultant, 中介, 移民, 律师, 律所, or
咨询. Skip a reply that advertises a service or says DM me, 私信, or
欢迎咨询, including "I am a lawyer" and "our law firm". Do not skip a
reply that asks for a lawyer recommendation: 求律师, 求推荐, "looking for
a lawyer", "lawyer recommendation". That person is the audience. Read the
chosen reply from the screen and keep those words before any tap on their
avatar. `outreach check` now. Reserve in step 4, after the bio is on
screen and before Follow is tapped. Pass the source post's first words as
`--title`, the reply as `--body`, and the bio as `--bio`. The same reply
goes on the follow record as `--note`.

**4. Open the profile, then follow, and do not call it done early.** The
post task is paused. Resume it to open the profile, with writes off, so
Follow is not tapped yet. The reply row has to be on screen. Do not start
a second task while this one is paused.

```json
resume_task({
  "task_id": "<id>",
  "goal": "On the open Threads post, scroll until the reply by <name> is fully on screen, name and reply text included. Read that reply. Do not tap a row that is off screen. Tap that replier's avatar. Stop when their profile is open and the button reads Follow, Following, 关注, or 已关注. Do not tap that button. Do not press Back. Do not search. Do not tap Reply.",
  "maxSteps": 10
})
```

Stop polling on `done` or `failed`. `phone_screen`, after `phone_status`
says the phone is not leased. The follow is done only when that button
reads Following or 已关注. The task status does not decide this: `done`
with the button still on Follow is not a follow, and `failed` can still be
a success if the button changed. The profile's own following count is how
many people they follow. It does not change when you follow them.
`phone_screen` is the check. Release the lease before the next task.

Read the bio now, before any reserve. If the name or the bio contains
lawyer, attorney, law firm, immigration consultant, 中介, 移民, 律师,
律所, or 咨询, do not reserve and do not tap Follow. One Back, then look.
`outreach reserve` the follow only when the name, the bio and the reply
are all allowed. Pass `--bio` with the bio on screen. A refusal (exit 3)
means one Back, then the next replier. There is no reservation to release.

If the button already reads Following or 已关注, do not tap. Record the
reserved follow as sent, with `--note` set to the reply you read on the
post and `--url` set to their profile.

If it reads Follow or 关注, the previous task has finished, so a new task
may start. No `launch`. This task is not a success until the button changes:

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "allowWrites": true,
    "repeat": 1,
    "countLabel": "^(Follow|关注)$",
    "goal": "The Threads profile of <name> is open. If the button reads Following or 已关注, do not tap it; stop. If it reads Follow or 关注, tap it exactly once. Then read the button. Stop when it reads Following or 已关注. If it still reads Follow or 关注, stop without tapping again; this follow is not done. Do not press Back, do not open a post, and do not tap Reply.",
    "pauseWhen": "the Threads profile of <name> is open and the button reads Follow, Following, 关注, or 已关注",
    "maxSteps": 6
  }]
})
```

`pauseWhen` here is the profile you are already on, so the write is the
resume of this task: `resume_task` with `allowWrites: true`, `repeat: 1`,
`countLabel` `^(Follow|关注)$`, and the same goal. Then look again.

Sent only when a screen read shows Following or 已关注. Pass
`--note "<the reply>"` on that record. If the button still reads Follow or
关注, or the profile never opened, the follow is not done. `outreach
release` that reservation and `reserve` it once more, then repeat this tap
once. Do not `record failed` on the first miss. The second miss is
`record failed`, and there is no third try.

**5. Like one of their posts, as its own step.** No `launch`. Open the
post by its text or its picture, not by their name. If their posts are
below the fold, bring one on screen with `phone_scroll` before this task.
Do not `phone_swipe`. `release_phone` before you start the task. Do not
hold that lease while the task is queued. Do not tap a heart that is
already filled.

```json
run_task({
  "phases": [{
    "goal": "You are on <name>'s profile inside Threads. Do not search and do not open a link or Chrome. Open their first post by tapping its text or its picture once, not their name. Stop when that post is open and a heart is on screen. Do not tap Like, the heart, Reply, Repost or Quote.",
    "pauseWhen": "a post by <name> is open and its heart is on screen, either empty and labelled Like or 赞, or already filled",
    "pauseScreenshot": true,
    "maxSteps": 8
  }]
})
```

Stop polling on `paused`. If the heart is filled, or the control reads
Liked, Unlike, or 已赞, do not reserve a like and do not tap it.
`resume_task` with `abandon: true` presses Back once. Look. You may open
the next post the same way, once. If that heart is filled too, stop
without a like.

If the control reads Like or 赞 and the heart is empty, reserve the like
(pass their name as `--author`, the post's first words as `--title`, and
the post URL as `--url` when it is on screen), then:

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(Like|赞)$",
  "goal": "The post is open. Tap the labelled Like or 赞 once. Do not tap a heart that is filled, and do not tap a control that reads Liked, Unlike, or 已赞. Then stop. Do not tap again even if the count looks unchanged. A second tap removes the like. Do not use a coordinate tap when the button has a label. Do not tap Reply.",
  "maxSteps": 5
})
```

If the heart has no label and it is empty, do not resume into more
scrolling. Reserve the like first. Then **one** `phone_tap` on the center
of that heart and no other coordinate. The guard allows that tap once while
the like reservation is held and refuses a second tap, a tap with no like
reservation, and a tap after this one. Then `phone_screen` once. Do not
tap again whatever it shows.

Record from a screen read, not from the task status and not from `sent`.
A like task often returns `sent: []` after a like that took. A filled
heart, Liked, or a count one higher means sent. Otherwise release once if
nothing was tapped, or record failed if the second look still shows an
empty heart.

**6. Back one screen at a time.** No `launch`, no search, no "until".

```json
run_task({
  "phases": [{
    "goal": "Press the in-app Back control exactly once, then stop immediately. Do not press Back a second time. Do not tap Search and do not open a link.",
    "maxSteps": 3
  }]
})
```

A Back task often ends `failed` or `stuck` after a Back that landed. That
status is not the outcome. `phone_screen` is. If you abandoned a paused
task to get here, that abandon already pressed Back once, so this may
already be the profile or the source post. Do not press Back again until
you have looked.

- The replier's profile is showing: one more task, the same single Back, then look again.
- The source post is showing, with its replies: stop. You are back. Scroll to the next reply only if you still need another replier.
- The search results for the keyword are showing: stop. Do not search.
- Home, or the search field with no results: you went too far. Stop. Do not press Back again and do not type the keyword again.

From the liked post the return is two Backs (their post, then their
profile, then the source post), unless an abandon already used one of
them. A further Back leaves the results. The next name starts from the
source post's replies. The next post in the search is one single Back from
the source post to the results, then the next card, still with no new
search.

## What comes back

The task status and `sent` do not decide the record. `phone_screen` does.
A follow is sent only when the button reads Following or 已关注, and the
record's `--note` is the reply you read before opening the profile. A task
that ended with the button still reading Follow is not a follow: release
it and retry once. A like is sent when the heart is filled, the label
reads Liked, or the count is one higher, even when `sent` is empty and
even when a Back task reported failed. One tap only. Record their profile
URL on the follow and the liked post's URL when they are on screen.

## Notes

- **The account is checked before any search.** Profile is the bottom-right
  tab. A different handle stops the run. There is no second account to try.
- **Don't allow on the notification dialog.** The first launch can ask
  "Allow Threads to send you notifications?". Tap Don't allow. Do not tap
  Allow, and do not treat that dialog as the profile.
- **Poll paused, then resume.** Waiting only for `done` holds a paused
  task. On `paused`, resume that task or abandon it. Do not start another
  task while one is paused.
- **The post body opens the post.** The author name and avatar open the
  author. The author is not followed, and the source post's heart is not
  the like.
- **Read the reply, then the profile.** The reply text is stored with the
  follow. A name or bio with lawyer, attorney, law firm, immigration
  consultant, 中介, 移民, 律师, 律所, or 咨询 is not followed. A reply that
  asks for a lawyer recommendation is the audience. A reply that says DM
  me, or that the writer is a lawyer or a firm, is not.
- **Following is the follow.** The button has to read Following or 已关注.
  The number on the profile is how many people they follow.
- **One empty heart, one tap.** A filled heart is never tapped. A second
  tap takes the like off. A labelled Like is the resume. An unlabeled
  heart is one `phone_tap` while the like reservation is held.
- **One Back, then look. Abandon is a Back.** `resume_task({ abandon: true })`
  presses Back once. Look before you add another.
- **`phone_scroll` brings a reply or a post on screen.** `phone_swipe` is
  refused. Release the lease before the next task. Another holder's lease
  is not yours to use or release. Six `phone_status` polls, then stop.
- **Not yet run on a phone.** Still to confirm on a device: the
  notification dialog's exact button, that Profile is bottom right and
  shows the handle, that search offers a Recent or Latest chip only
  sometimes, that the post body opens the post and the author name does
  not, that a reply row's avatar opens that replier, that Follow changes
  to Following, that an empty heart likes on one tap and a filled heart is
  visibly filled, and that one Back returns to the thread and then the
  results.
