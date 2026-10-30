---
name: xiaohongshu-follow-commenter-and-like-latest
description: Search Xiaohongshu (小红书, RedNote) once, open one recent note, then follow one commenter and, as a separate step, like one photo note of theirs. Use when outreach should reach people who commented on a topic, without commenting, messaging, following the author, or liking the source note.
kind: workflow
title: Follow Xiaohongshu commenters and like their latest note
apps: com.xingin.xhs
writes: true
reviews: true
---

# Follow Xiaohongshu commenters and like their latest note

Searches Xiaohongshu once, switches to Latest, and opens one recent note.
Tap the 评论 control (the comment count) so the comment panel opens; the
avatars in that panel are on screen and tappable. Inline comments further
down the note are in the accessibility tree before they are on screen, so
a pause that trusts them fires early and the taps miss. Each commenter is
two short writes: follow them, and only then like one photo note of theirs.
The source note is not liked and its author is not followed. Nothing is
commented, replied or sent as a message.

Stay inside the app. Do not open a profile URL. `resume_task` with
`abandon: true` presses Back once as it leaves. After an abandon, look at
the screen before you press Back yourself.

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
| **query** | the keyword to search, not a note title, e.g. `NIW 获批` |
| **name** | one commenter's nickname, chosen at the pause, e.g. `小李同学` |

One name per follow, and one name per like.

## Run it

**1. Search once, sort Latest, open one note, open its comment panel.**
Nothing is written. `launch` is only on this first search. Skip a result
card whose author is the signed-in account; do not open it. On the note,
tap the comment control that shows the count (`评论 35`, `评论`, or
Comment). That opens a panel whose avatars are on screen. Do not pause on
the inline comments under the note: they match while they are still below
the fold, and taps there miss.

```json
run_task({
  "phases": [{
    "launch": "com.xingin.xhs",
    "goal": "In the Xiaohongshu app, tap the Search control at the top right, tap the search field, type '<query>', and tap the Search button. This is a keyword search, not a note title. Do not read the home feed (Following, Explore, Nearby, or 关注, 发现, 附近). Do not open a link or Chrome. On the results, before scrolling cards, tap Latest or 最新 beside Top or 综合. Skip cards labelled Ads or 广告. Skip any card whose author is <signed-in name> without opening it. Open one recent note by tapping the picture on its card, the cover image, and nothing else on that card. Do not tap the title text, the author name, or any other text. If the picture does not open the note, stop. On the note, tap the comment control that shows the count, labelled 评论 or Comment (for example 评论 35), so the comment panel opens. Do not scroll to the inline comments and do not treat them as the list. Do not tap Follow, 关注, or any heart. Do not like, collect, follow, comment, reply or message.",
    "typeTexts": ["<query>"],
    "pauseWhen": "the comment panel is open on the note from '<query>': commenter names and their avatars are on screen, with a comment input at the bottom of the panel",
    "pauseScreenshot": true,
    "maxSteps": 24
  }]
})
```

Stop polling when status is `paused`. Read the age, the note text, and each
commenter's name and the comment next to it. Keep that comment text. You
will need it before you open their profile. Reserve nothing before that.

**2. Choose one name.** Skip a note whose title or body has a clear agency
signal: 欢迎咨询, 中介, 代办, 办理, 移民公司, or 私信. A personal note that
mentions 律所 or 律师 is still a source. Skip a commenter whose **name**
contains 中介, 移民, 律师, 律所, 咨询, 办理, 代办, 移民公司, or 私信. Do
not skip a comment that asks 求律所 or 求律师推荐; that person is the
audience. Skip the author, the signed-in account, and an official or brand
account. Read the chosen commenter's comment from the panel and keep those
words before any tap on their avatar. `outreach check`, then reserve the
follow, before the tap in step 3. Pass the note title as `--title`. Pass
`--body` only for the note text, not for a comment that merely says 律所 or
律师. The comment itself goes on the follow record as `--note`.

**3. Open the profile, then follow, and do not call it done early.** The
panel task is paused. Resume it to open the profile, with writes off, so
Follow is not tapped yet. Do not start a second task while this one is paused.

```json
resume_task({
  "task_id": "<id>",
  "goal": "In the comment panel, scroll until the row named <name> is fully on screen, avatar and their comment text included. Read that comment. Do not tap a row that is off screen. Tap that avatar. Stop when their profile is open and the button beside the nickname reads Follow, Following, Friends, 关注, 已关注, or 互相关注. Do not tap that button. Do not press Back. Do not search.",
  "maxSteps": 10
})
```

Stop polling on `done` or `failed`. `phone_screen`. The follow is done
only when that button reads Following, Friends, 已关注, or 互相关注. The
task status does not decide this: `done` with the button still on Follow
is not a follow, and `failed` can still be a success if the button changed.
The profile's own Following number is how many people they follow; it does
not change when you follow them. `phone_screen` is the check.

If it already reads Following, Friends, 已关注, or 互相关注, do not tap.
Record the reserved follow as sent, with `--note` set to the comment you
read in the panel.

If it reads Follow or 关注, the previous task has finished, so a new task
may start. No `launch`. This task is not a success until the button changes:

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "allowWrites": true,
    "repeat": 1,
    "countLabel": "^(关注|Follow)$",
    "goal": "The profile of <name> is open. If the button reads Following, Friends, 已关注, or 互相关注, do not tap it; stop. If it reads Follow or 关注, tap it exactly once. Then read the button. Stop when it reads Following, Friends, 已关注, or 互相关注. If it still reads Follow or 关注, stop without tapping again; this follow is not done. Do not press Back and do not open a note.",
    "pauseWhen": "the profile of <name> is open and the button beside the name reads Follow, Following, Friends, 关注, or 已关注",
    "maxSteps": 6
  }]
})
```

`pauseWhen` here is the profile you are already on, so the write is the
resume of this task: `resume_task` with `allowWrites: true`, `repeat: 1`,
`countLabel` `^(关注|Follow)$`, and the same goal. Then look again.

Sent only when a screen read shows Following, Friends, 已关注, or 互相关注.
Pass `--note "<the comment>"` on that record. If the button still reads
Follow or 关注, or the profile never opened, the follow is not done.
`outreach release` that reservation and `reserve` it once more, then repeat
this tap once. Do not `record failed` on the first miss. The second miss is
`record failed`, and there is no third try.

**4. Like one photo note, as its own step.** No `launch`. Prefer a photo
or carousel: its Like control has a label. A video heart is an unlabeled
icon and a label tap cannot hit it. If the notes grid is below the fold,
bring it on screen with `phone_scroll` before this task. Do not
`phone_swipe`: the guard refuses it. `release_phone` before you start the
task. Do not hold that lease while the task is queued.

```json
run_task({
  "phases": [{
    "goal": "You are on <name>'s profile inside the Xiaohongshu app, and the notes grid is on screen. Do not search and do not open a link or Chrome. In the grid, from the top, skip a video (a play icon or a duration). Open the first photo or carousel by tapping its picture once, not its title text. If every visible note is a video, open the first video by its picture and stop without tapping anything on it. Stop when the note is open. Do not tap Like, 赞, or the heart.",
    "pauseWhen": "a note by <name> is open, either with a labelled Like, Liked, 赞 or 已赞, or a video whose heart icon is on screen",
    "pauseScreenshot": true,
    "maxSteps": 8
  }]
})
```

Stop polling on `paused`. If the control already reads Liked or 已赞, or
the heart is filled, `resume_task` with `abandon: true`. Abandon presses
Back once. `phone_screen` before you press Back yourself. Do not reserve a
like.

If it is a labelled Like, 赞 or 点赞, reserve the like (pass the note title
and any body as `--title` and `--body`), then:

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(赞|点赞|Like)$",
  "goal": "The note is open. Tap the labelled Like, 赞 or 点赞 once. Do not tap a control that reads Liked or 已赞. Then stop. Do not tap again even if the count looks unchanged. A second tap removes the like. Do not use a coordinate tap when the button has a label.",
  "maxSteps": 5
})
```

If the note is a video and the heart has no label, do not resume into more
scrolling. Reserve the like first. Then **one** `phone_tap` on the center
of that heart and no other coordinate. The guard allows that tap once while
the like reservation is held and refuses a second tap, a tap with no like
reservation, and a tap after this one. Then `phone_screen` once. Do not
tap again whatever it shows.

Record from a screen read, not from the task status and not from `sent`.
A like task often returns `sent: []` after a like that took. A filled
heart, Liked, 已赞, or a count one higher means sent. Otherwise release
once if nothing was tapped, or record failed if the second look still
shows an empty heart.

**5. Back one screen at a time.** No `launch`, no search, no "until".

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
already be the profile or the note. Do not press Back again until you have
looked.

- The commenter's profile is showing: one more task, the same single Back, then look again.
- The source note is showing, or its comment panel is open: stop. You are back. Re-open the panel with 评论 only if you still need another commenter and the panel is gone.
- Latest results for the keyword are showing: stop. Do not search.
- Explore, Following, Nearby, or the search home (Recent searches): you went too far. Stop. Do not press Back again and do not type the keyword again.

From the liked note the return is two Backs (note, then profile, then the
source note), unless an abandon already used one of them. A further Back
lands on Explore or the search home. The next name starts from the comment
panel. The next card is one single Back from the source note to the Latest
results, then the next avatar, still with no new search.

## What comes back

The task status and `sent` do not decide the record. `phone_screen` does.
A follow is sent only when the button reads Following, Friends, 已关注, or
互相关注, and the record's `--note` is the comment you read before opening
the profile. A task that ended with the button still reading Follow is not
a follow: release it and retry once. A like is sent when the heart is
filled, the label reads Liked or 已赞, or the count is one higher, even
when `sent` is empty and even when a Back task reported failed. One tap
only. Record the 小红书号 on the follow as `user:<id>` and the liked note's
title when they are on screen.

## Notes

- **Poll paused, then resume.** On 2026-10-28 a loop that waited only for
  `done` polled a paused task for about nine minutes. Stopping the loop
  cancelled the pause and the screen had to be found again.
- **Open the comment panel.** Inline comments are in the accessibility
  tree below the fold, so a pause on them fires while the names are off
  screen and the avatar taps miss. The 评论 count opens a real panel.
  On 2026-10-28 that panel was what had tappable avatars.
- **Scroll inside the panel, then tap the avatar.** The row has to be on
  screen. A follow is not done until the button reads Following or 已关注.
- **Photo notes have a labelled Like. Video hearts do not.** A coordinate
  tap is the one unlabeled heart, once, with a like reservation held.
  Prefer the labelled button. Never a second tap: it toggles the like off.
- **One Back, then look. Abandon is a Back.** `resume_task({ abandon: true })`
  presses Back once. Look before you add another. Extra Backs land on
  Explore or the search home, and there is no second search to recover.
- **求律所 is the audience.** 律师 and 律所 in a comment, or in a personal
  note, do not skip it. Names still do. A title or body skips on 欢迎咨询,
  中介, 代办, 办理, 移民公司, or 私信. Skip the signed-in account's card
  without opening it.
- **The profile Following count is theirs.** It does not move when you
  follow them. The button does.
- **Rate limits.** "操作太频繁" or "请稍后再试" means stop for the day.
- **The picture opens the card.** Tapping the title text stalls. The cover
  image is the only tap.
- **`phone_scroll` brings the profile grid up.** `phone_swipe` is refused.
  Release the lease before the next task.
- **Seen on a phone, 2026-10-28.** Three follows and three photo likes,
  one tap each, from the comment panel, with Back returning to the note.
  A follow that reports Friends counts. What this revision still needs on
  a phone: skipping another holder's lease, opening the card only by its
  picture, and the comment text landing on the follow record.
