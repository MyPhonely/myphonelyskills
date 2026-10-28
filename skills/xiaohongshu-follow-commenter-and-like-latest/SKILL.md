---
name: xiaohongshu-follow-commenter-and-like-latest
description: Search Xiaohongshu (小红书, RedNote) once, open one recent note, then follow one commenter and, as a separate step, like one latest note of theirs. Use when outreach should reach people who commented on a topic, without commenting, messaging, following the author, or liking the source note.
kind: workflow
title: Follow Xiaohongshu commenters and like their latest note
apps: com.xingin.xhs
writes: true
reviews: true
---

# Follow Xiaohongshu commenters and like their latest note

Searches Xiaohongshu once, switches to Latest, and opens one recent note.
It stops on that note's comment sheet so the names can be chosen before
anything is written. Each commenter is then two short writes, and nothing
else: follow them, stop and record, then like one latest note of theirs.
The source note is not liked and its author is not followed. Nothing is
commented, replied or sent as a message.

Stay inside the Xiaohongshu app. Do not open a profile URL: that leaves
the app and opens Chrome. Come back with the in-app Back control. Do not
search again while that Back path still shows the note or the results.

## Inputs

| | |
|---|---|
| **query** | the keyword to search, not a note title, e.g. `NIW 获批` |
| **name** | one commenter's nickname, chosen at the pause, e.g. `小李同学` |

One name per follow, and one name per like. Do not hand the operator a list.

## Run it

**1. Search once, sort Latest, open one note's comments.** Nothing is written.
In outreach, do not `reserve` until the pause shows who is there. `launch`
is only on this first search. Every later call in this keyword omits it:
`launch` force-stops the app and the results are gone.

```json
run_task({
  "phases": [{
    "launch": "com.xingin.xhs",
    "goal": "In the Xiaohongshu app, tap the Search control at the top right, tap the search field, type '<query>', and tap the Search button. This is a keyword search, not a search for a note title. Do not read the home feed (Following, Explore, Nearby, or 关注, 发现, 附近). Do not open a link and do not switch to Chrome or any browser. On the results, before scrolling any card, tap Latest or 最新 in the sort row next to Top or 综合 and check that chip is selected. Skip cards labelled Ads or 广告 and skip the account you are signed in as. Open one recent note by tapping the author's avatar on the card (the round image by their name, often liveAvatar). If that opens a profile instead of the note, press Back and tap the card's picture beside the title once. Do not tap the title text, and do not tap the cover image first. On the note, do not tap Follow, Following, 关注 or the heart. Tap the comment bubble at the bottom so the comment sheet opens. Do not like, collect, follow, comment, reply or message.",
    "typeTexts": ["<query>"],
    "pauseWhen": "the comment sheet of a note from the '<query>' search is open, with commenter nicknames and a comment input (说点什么, Say something, Share your thoughts or Drop a comment) at the bottom",
    "pauseScreenshot": true,
    "maxSteps": 24
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. Read the
note's age and the commenter names off that screen.

**2. Choose one name.** Keep an individual. Skip the note's author, the
signed-in account, an official or brand account, and any nickname containing
中介, 移民, 律师, 律所 or 咨询. In outreach, `outreach check` and `reserve`
the follow before step 3. A no is `resume_task` with `abandon: true`.

**3. Follow that one person, then stop.** Do not open a note in this call.

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(关注|Follow)$",
  "goal": "On this comment sheet, find the commenter named <name> and tap their avatar so their profile opens inside the Xiaohongshu app. Do not press Back. Do not search. Do not open a link, a profile URL, Chrome or any browser. On the profile, the button next to the nickname reads Follow or 关注, or it already reads Following, 已关注 or 互相关注. If it already reads Following, 已关注 or 互相关注, do not tap it. Otherwise tap Follow or 关注 exactly once. Then stop on this profile. The follow took if the button now reads Following, 已关注 or 互相关注, or the Following count went up by one. Do not tap the button again. Do not open a note, do not like, comment or message.",
  "maxSteps": 12
})
```

Poll until `done`. Record this follow from the screen you stopped on before
doing anything else. If the button still reads Follow or 关注, record
failed. Do not run the follow again.

The next commenter is not a resume of this task. It is a new `run_task`
with no `launch`, the same goal, starting from the comment sheet.

**4. Like one latest note, as its own step.** Start from the profile step 3
left open. No `launch`.

```json
run_task({
  "phases": [{
    "goal": "You are on <name>'s profile inside the Xiaohongshu app. Do not search, do not press Home, and do not open a link or Chrome. Tap the first picture in the notes grid once so their latest note opens. Stop when the note is open and the heart at the bottom is visible. Do not tap the heart. Do not follow, comment or share.",
    "pauseWhen": "a note by <name> is open and the heart at the bottom is visible, labelled Like, Liked, 赞 or 已赞",
    "pauseScreenshot": true,
    "maxSteps": 8
  }]
})
```

Poll until `paused`. If the heart is filled or the label reads Liked or
已赞, `resume_task` with `abandon: true` and do not reserve a like. Tapping
would remove the like.

Otherwise reserve the like, then tap the heart once:

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(赞|点赞|Like)$",
  "goal": "The note is open. Tap the heart once. It is labelled Like, 赞 or 点赞, not Liked or 已赞. Then stop. Do not tap the heart again for any reason, even if the count looks unchanged. A second tap removes the like. Do not follow, comment, share, go back, or open a browser.",
  "maxSteps": 5
})
```

Poll until `done`. Record from that screen. A filled heart, Liked, 已赞, or
a count one higher means it took. If the screen does not show that, record
failed. Do not tap again. One `phone_screen` is enough when the task result
never mentions the heart. Do not open Me and do not scroll a likes list.

**5. Back to the same comment sheet.** No `launch`, no search.

```json
run_task({
  "phases": [{
    "goal": "Press the in-app Back control until the comment sheet you came from is showing, still inside the Xiaohongshu app. Do not tap Search, do not type, do not open a link, and do not switch to Chrome or any browser. If that sheet is already showing, stop.",
    "maxSteps": 6
  }]
})
```

Poll until `done`. The next name starts at step 3 from this sheet.

To open the next note, press Back until the Latest results for `<query>`
are showing and tap the next card's avatar. Search the keyword again only
when Back cannot reach those results. Never search the note's title.

## What comes back

A follow is done when the profile button reads Following, 已关注 or
互相关注, or the Following count went up by one. `sent` may list Follow or
关注. A like is done when the heart is filled, the label reads Liked or
已赞, or the count is one higher. `sent` often omits the like; the screen
is the check, and a second tap is not a retry. Record the profile id on the
follow and the liked note's title and id on the like when they are on screen.

## Notes

- **One commenter, then stop.** On 2026-10-28 a resume that followed and
  liked several names in one goal never tapped Follow. It went back and
  forth between the profile and the comment sheet and hit its step cap.
  Follow is its own call. The like is the next call, after the follow is
  recorded.
- **The heart is toggled by a second tap.** The same run tapped it twice:
  one like was undone, and another's count dipped and came back. Tap once.
  A heart that already reads Liked or 已赞, or is filled, is left alone.
- **Back, not a new search, not Chrome.** A relaunch dropped the results,
  so the keyword was searched again. A profile link opened in Chrome.
  Omit `launch` after the first search. Do not use `openUrl`. Press Back.
- **Labels are Chinese or English.** Follow / Following and Like / Liked,
  and 关注 / 已关注 / 互相关注 and 赞 / 点赞 / 已赞.
- **The avatar opens a search card.** The cover image and the title text
  did not, on 2026-10-28. On a profile grid the note is the picture, so
  tap that picture.
- **Latest, or the notes are old.** The chip is beside Top or 综合.
- **Ages.** The note may say "Edited on Apr/10/2024", "Edited on May 21",
  "1 day(s) ago", "10-14", "3天前", "昨天" or "编辑于2024年4月10日". In
  outreach, `outreach age` normalizes them.
- **Ids.** The profile's 小红书号 is on screen; pass it as `user:<id>`
  when it is only the number. A note id is the 24-character hex when one
  is visible. Do not open Share just to copy a link.
- **Rate limits.** "操作太频繁" or "请稍后再试" means stop for the day.
- **Still needs a live check.** The split follow, the single heart tap,
  and Back to the same sheet have not been run on a phone.
