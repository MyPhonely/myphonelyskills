---
name: xiaohongshu-collect-notes
description: Collect notes from a Xiaohongshu (RedNote) search with title, author and like count, skipping ads. Use when asked to research a topic on Xiaohongshu or RedNote, track what creators are posting there, or gather notes about a product or place.
kind: workflow
title: Collect notes from Xiaohongshu
apps: com.xingin.xhs
writes: false
reviews: false
---

# Collect notes from Xiaohongshu

Searches Xiaohongshu in the app, switches to the newest notes when that sort
is offered, and reads each card: title, author, likes and age. Xiaohongshu is
app-first and hostile to anything else, so a signed-in phone is the practical
way to read it, and the results are the ones its ranking actually serves your
account.

Nothing is liked, collected, followed or commented on.

## Inputs

| | |
|---|---|
| **query** | what to search for, in Chinese or English, e.g. `西雅图 咖啡` |
| **count** | how many notes to collect, default 10 |

## Run it

```json
phone_task({
  "launch": "com.xingin.xhs",
  "goal": "In the Xiaohongshu app, tap the search icon at the top, type '<query>', and submit. On the results screen make sure the notes tab is active, and tap 最新 or Latest if that sort is offered. Then keep scrolling the note results. Do not open a note, and do not like, collect, follow or comment.",
  "steps": ["Xiaohongshu is open",
            "Search results for '<query>' are showing"],
  "typeTexts": ["<query>"],
  "maxSteps": 16,
  "collect": {
    "record": "a note card in the search results",
    "fields": { "title": "the note title",
                "author": "the nickname of the account that posted it",
                "likes": "the like count, if shown",
                "age": "how long ago it was posted, if shown" },
    "judge": { "organic": "the card is a normal note, not an advertisement labelled Ads or 广告" },
    "require": { "organic": 0.7 },
    "where": "the note search results are showing",
    "count": <count>
  }
})
```

## What comes back

`result.collected` holds one record per note, with `p_organic` showing how
sure the ad judgment was. Note bodies, images and comments are on each note's
own page.

## Notes

- Ads are labelled `Ads` or `广告` on the card, which is what the judge claim
  keys on. Marketing posts by real accounts are not ads and are kept.
- The app's language follows the account, so tabs may read 综合 / 笔记 / 用户
  or All / Notes / Users. The goal names both, and the operator matches
  whichever is on screen.
- The Latest sort is not always offered. When it is missing the run continues
  on the default ranking rather than failing.
