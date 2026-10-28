---
name: xiaohongshu-follow-commenter-and-like-latest
description: Search Xiaohongshu (小红书, RedNote) once, open one recent note, and after approval follow named commenters and like one latest note of each, confirming both on screen. Use when outreach should reach people who commented on a topic, without commenting, messaging, following the author, or liking the source note.
kind: workflow
title: Follow Xiaohongshu commenters and like their latest note
apps: com.xingin.xhs
writes: true
reviews: true
---

# Follow Xiaohongshu commenters and like their latest note

Searches Xiaohongshu once, switches to Latest, and opens one recent note.
It stops on that note's comment sheet so the names can be chosen before
anything is written. On approval it follows only those commenters and likes
one latest note of each, then comes back to the same sheet for the next
name. The source note is not liked and its author is not followed. Nothing
is commented, replied or sent as a message.

Searching a note's title does not find it again: the results change between
searches. Stay on the note this search already opened.

## Inputs

| | |
|---|---|
| **query** | the keyword to search, not a note title, e.g. `NIW 获批` |
| **names** | commenter nicknames to follow, chosen at the pause, e.g. `小李同学` |

## Run it

**1. Search once, sort Latest, open one note's comments.** Nothing is written.
In outreach, do not `reserve` until the pause shows who is there.

```json
run_task({
  "phases": [{
    "launch": "com.xingin.xhs",
    "goal": "In the Xiaohongshu app, tap the Search control at the top right, tap the search field, type '<query>', and tap the Search button. This is a keyword search, not a search for a note title. Do not read the home feed (Following, Explore, Nearby, or 关注, 发现, 附近). On the results, before scrolling any card, tap Latest or 最新 in the sort row next to Top or 综合 and check that chip is selected. It sits in that row and is easy to scroll past. Skip cards labelled Ads or 广告 and skip the account you are signed in as. Open one recent note by tapping the author's avatar on the card (the round image by their name, often liveAvatar). If that opens a profile instead of the note, press back and tap the card's picture beside the title once. Do not tap the title text, and do not tap the cover image first: on 2026-10-28 neither opened the note. On the note, do not tap Follow, Following, 关注 or the heart. Tap the comment bubble at the bottom so the comment sheet opens. Do not like, collect, follow, comment, reply or message.",
    "typeTexts": ["<query>"],
    "pauseWhen": "the comment sheet of a note from the '<query>' search is open, with commenter nicknames and a comment input (说点什么, Say something, Share your thoughts or Drop a comment) at the bottom",
    "pauseScreenshot": true,
    "maxSteps": 24
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. Read the
note's age and the commenter names off that screen. To open the next card
from results that are already showing, run this again without `launch` and
without typing: the goal starts "The search results for '<query>' are
already showing with Latest or 最新 selected. Do not search again." Search
the keyword once more only when those results are gone.

**2. Choose the names.** Keep individuals. Skip the note's author, the
signed-in account, an official or brand account, and any nickname containing
中介, 移民, 律师, 律所 or 咨询. In outreach, `outreach check` and `reserve`
each follow, then each like, before step 3. A no is `resume_task` with
`abandon: true`.

**3. Follow them and like one latest note each.**

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": <number of names>,
  "countLabel": "^(关注|Follow)$",
  "goal": "Follow only these commenters, each once, then like one latest note of each: <name 1>, <name 2>. Stay on this comment sheet between names. Do not search. Do not follow the note's author and do not tap this note's heart (Like, 赞, 点赞). Do not comment, reply or message. For each name: find their row (scroll the sheet if needed), skip a row marked 作者, and skip a name not in the list. Tap their avatar to open their profile. If the button already reads Following, 已关注 or 互相关注, do not tap it. Otherwise tap Follow or 关注 once and read the button: it must then read Following, 已关注 or 互相关注. Read the 小红书号 or Xiaohongshu ID if it is on the profile. Open their latest note by tapping the first picture in the notes grid. On that note tap Like or 赞 or 点赞 once, then read the screen: the heart is filled, or the label reads Liked or 已赞, or the count went up by one. A second tap undoes it. Do not open Share. Press back until this comment sheet is showing again, and do the next name. Report each name, whether the button reads Following or 已关注, whether the heart is filled, the profile id, and the liked note's title and any id that was visible.",
  "maxSteps": <14 times the number of names, at least 18>
})
```

`repeat` counts follows only. A like often never shows up in `sent`; the
screen is the check. Poll until `done`.

## What comes back

`result.phases[0].sent` lists follows whose effect showed (Following,
已关注). It often omits the like even when the heart filled. Trust a like
only when the run's report or a later screen read shows a filled heart,
Liked or 已赞, or a count one higher. Record the profile id on the follow
and the liked note's id on the like when the report includes them. A name
with no effect was not followed: do not tap it again in this run.

## Notes

- **One search, then the open note.** Re-finding a note by its title failed
  on 2026-10-28: the query returns loose results and they shift between
  runs. That search was most of the credit cost. Work every chosen
  commenter before leaving the sheet.
- **Labels are Chinese or English.** This account showed Follow / Following
  and Like / Liked. Match both, and 关注 / 已关注 / 互相关注 and 赞 / 点赞 / 已赞.
  A button that already reads Following or 已关注 toggles off if tapped.
- **The avatar opens a search card.** The cover image and the title text did
  not, on 2026-10-28. A profile grid is different: the note is the picture,
  so tap that picture.
- **Latest, or the notes are old.** The chip is in the sort row beside Top
  or 综合, under the tabs. Without it, results are weeks old.
- **Ages are mixed.** The note may say "1 day(s) ago", "Yesterday 12:18",
  "10-14", "2024-04-11", "3天前" or "昨天". In outreach, `outreach age`
  normalizes them. Skip a note you cannot date.
- **Ids.** The profile's 小红书号 is on screen; pass it as the follow's url
  (`user:<id>` when it is only the number). A note id is the 24-character
  hex in an explore link when one is visible. Do not open Share just to
  copy a link. A missing id still records; the title is the fallback.
- **Rate limits.** "操作太频繁" or "请稍后再试" means stop for the day.
  Keep a run to the handful of names you reserved.
- **Not yet run as a whole.** On 2026-10-28 a supervised run liked and
  followed two open notes (the like was visible on screen and absent from
  `sent`; Follow became Following). It never reached a commenter. The
  search-once, avatar-open, follow-then-like route above is the fix and
  still needs a live phone check.
