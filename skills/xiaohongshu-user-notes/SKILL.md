---
name: xiaohongshu-user-notes
description: List the notes posted by one Xiaohongshu (RedNote) account with titles and like counts. Use when asked what a creator posts about, to research an influencer before a collaboration, or to track a brand account on Xiaohongshu.
kind: workflow
title: List a Xiaohongshu creator's notes
apps: com.xingin.xhs
writes: false
reviews: false
---

# List a Xiaohongshu creator's notes

Finds an account in the Xiaohongshu app, opens its profile, and reads its note grid: each note's title and like count. Signed in as you, so an account that requires following to view reads if you follow it.

Nothing is followed, liked or messaged.

## Inputs

| | |
|---|---|
| **nickname** | the account's nickname as shown on the app, e.g. `芝麻酱` |
| **count** | how many notes to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.xingin.xhs",
  "goal": "In the Xiaohongshu app, tap the Search control at the top right, type '<nickname>', and submit. Tap the Users or 用户 tab and tap the account named <nickname> so its profile opens. Then keep scrolling down the profile's notes. Do not follow, like, or open a note.",
  "steps": [
    "A profile page for <nickname> is showing",
    "A grid of notes by <nickname> is showing"
  ],
  "typeTexts": [
    "<nickname>"
  ],
  "findTexts": [
    "<nickname>"
  ],
  "maxSteps": 16,
  "collect": {
    "record": "a note card on the profile's notes grid",
    "fields": {
      "title": "the note title",
      "likes": "the like count, if shown"
    },
    "where": "note cards by <nickname> are showing on the profile page",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per note. Bodies, images and comments are on each note's own page.

## Notes

- Common nicknames return several accounts. Give the exact nickname and, if the run picks the wrong one, add the follower count or bio phrase to the goal to disambiguate.
