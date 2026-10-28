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
Comments on this app are inline on the note page, below the fold, not a
separate sheet. Scroll until the names are on screen, then stop. Each
commenter is two short writes: follow them and record, then like one photo
note of theirs. The source note is not liked and its author is not followed.
Nothing is commented, replied or sent as a message.

Stay inside the app. Do not open a profile URL. Come back with one Back at
a time, and read the screen after each one.

## Polling

After every `run_task` and `resume_task`, poll
`get_task_status(task_id, wait_seconds: 30)` and **stop on the first**
status of `paused`, `done`, `failed`, `cancelled` or `expired`. Do not
wait only for `done`. A paused task is not still running: stop polling it.
Cap the wait at six polls (about three minutes), then use the last status.
On `paused`, the next call is `resume_task` on that same `task_id`. Do not
start a new `run_task` while a task is paused; that abandons the screen.
On `failed`, do not poll again and do not repeat the same call.

## Inputs

| | |
|---|---|
| **query** | the keyword to search, not a note title, e.g. `NIW 获批` |
| **name** | one commenter's nickname, chosen at the pause, e.g. `小李同学` |

One name per follow, and one name per like.

## Run it

**1. Search once, sort Latest, open one note, scroll to its comments.**
Nothing is written. `launch` is only on this first search. Comments are
inline: scroll the note until nicknames are visible. Do not wait for a
comment sheet.

```json
run_task({
  "phases": [{
    "launch": "com.xingin.xhs",
    "goal": "In the Xiaohongshu app, tap the Search control at the top right, tap the search field, type '<query>', and tap the Search button. This is a keyword search, not a note title. Do not read the home feed (Following, Explore, Nearby, or 关注, 发现, 附近). Do not open a link or Chrome. On the results, before scrolling cards, tap Latest or 最新 beside Top or 综合. Skip cards labelled Ads or 广告 and the account you are signed in as. Open one recent note by tapping the author's avatar on the card (liveAvatar). If that opens a profile, press Back once and tap the card's picture. Do not tap the title or the cover first. Then scroll down the note itself until commenter nicknames are on screen. Comments are inline on the note, far below the fold, not in a sheet. Do not tap Follow, 关注, or any heart. Do not like, collect, follow, comment, reply or message.",
    "typeTexts": ["<query>"],
    "pauseWhen": "the note from the '<query>' search is open and at least one commenter nickname is visible on the page",
    "pauseScreenshot": true,
    "maxSteps": 24
  }]
})
```

Stop polling when status is `paused`. Read the age, the note text, and the
names. If the names are still below the fold, the pause did not match: do
not start a second search. Resume is not a write yet; abandon only to leave.

**2. Choose one name.** Skip the note when its title or on-screen body
contains 中介, 咨询, 办理, 代办, 律所, 移民公司 or 私信, and pass that text
as `--title` and `--body` so `reserve` refuses it too. Skip the author, the
signed-in account, an official or brand account, and a commenter whose name
or comment contains those words, or 移民 or 律师 in the name. `outreach
check`, then reserve the follow, before step 3.

**3. Follow that one person, then stop.** Scroll their row on screen before
tapping. Do not open a note in this call.

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(关注|Follow)$",
  "goal": "Scroll the note until the commenter named <name> and their avatar are fully on screen. Do not tap an avatar that is off screen or only partly visible. Then tap that avatar so their profile opens inside the Xiaohongshu app. Do not press Back. Do not search. Do not open a link or Chrome. On the profile, if the button already reads Following, 已关注 or 互相关注, do not tap it. Otherwise tap Follow or 关注 exactly once and stop on this profile. The follow took only if that button now reads Following, 已关注 or 互相关注. The profile's own Following number is how many people they follow; it does not change when you follow them, so do not use it. Do not tap again. Do not open a note.",
  "maxSteps": 12
})
```

Stop polling on `done` or `failed`. Record the follow before anything else.
The button is the check. Still Follow or 关注: record failed, do not tap
again.

The next commenter is a new `run_task` with no `launch`, the same goal,
only after you are back on this note.

**4. Like one photo note, as its own step.** No `launch`. Prefer a photo
or carousel: its Like control has a label. A video heart is an unlabeled
icon and a label tap cannot hit it.

```json
run_task({
  "phases": [{
    "goal": "You are on <name>'s profile inside the Xiaohongshu app. Do not search and do not open a link or Chrome. In the notes grid, from the top, skip a video (a play icon or a duration). Open the first photo or carousel by tapping its picture once. If every visible note is a video, open the first video and stop without tapping anything on it. Stop when the note is open. Do not tap Like, 赞, or the heart.",
    "pauseWhen": "a note by <name> is open, either with a labelled Like, Liked, 赞 or 已赞, or a video whose heart icon is on screen",
    "pauseScreenshot": true,
    "maxSteps": 8
  }]
})
```

Stop polling on `paused`. If the control already reads Liked or 已赞, or
the heart is filled, `resume_task` with `abandon: true`. Do not reserve a
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

Record from that screen. A filled heart, Liked, 已赞, or a count one higher
means sent. Otherwise failed. `sent` often omits the like.

**5. Back one screen at a time.** No `launch`, no search, no "until".

```json
run_task({
  "phases": [{
    "goal": "Press the in-app Back control exactly once, then stop immediately. Do not press Back a second time. Do not tap Search and do not open a link.",
    "maxSteps": 3
  }]
})
```

Stop polling on `done`. Then `phone_screen`:

- The commenter's profile is showing: one more task, the same single Back, then look again.
- The source note is showing (its title, or the commenter names inline): stop. You are back.
- Explore, Following or Nearby is showing: you went too far. Stop. Do not press Back again and do not search.

Two Backs is the whole return (liked note, then profile, then source note).
A third Back is what lands on Explore. The next name starts from the source
note. The next card is one further single Back to the Latest results, then
the next avatar, still with no new search.

## What comes back

A follow is sent when the profile button reads Following, 已关注 or
互相关注. A like is sent when the heart is filled, the label reads Liked
or 已赞, or the count is one higher. One tap only. Record the 小红书号 on
the follow as `user:<id>` and the liked note's title when they are on screen.

## Notes

- **Poll paused, then resume.** On 2026-10-28 a loop that waited only for
  `done` polled a paused task for about nine minutes. Stopping the loop
  cancelled the pause and the screen had to be found again.
- **Comments are inline.** The same run's pause waited for a comment sheet
  this app does not open. The names are on the note, below the fold.
- **Scroll, then tap the avatar.** Tapping an off-screen avatar's
  coordinates missed. The row has to be on screen first.
- **Photo notes have a labelled Like. Video hearts do not.** A coordinate
  tap is the one unlabeled heart, once, with a like reservation held.
  Prefer the labelled button. Never a second tap: it toggles the like off.
- **One Back, then look.** Five or six Backs skipped the note and the
  results and ended on Explore. There is no second search to recover.
- **Promo is the text, not only the nickname.** 中介, 咨询, 办理, 代办,
  律所, 移民公司 and 私信 in a title, body or comment skip that note or
  commenter. `reserve` refuses the same words.
- **The profile Following count is theirs.** It does not move when you
  follow them. The button does.
- **Rate limits.** "操作太频繁" or "请稍后再试" means stop for the day.
- **Still needs a live check.** The inline-comment pause, a labelled Like
  on a photo note, one heart tap on a video, and two single Backs back to
  the source note have not been run on a phone. The single Follow tap has.
