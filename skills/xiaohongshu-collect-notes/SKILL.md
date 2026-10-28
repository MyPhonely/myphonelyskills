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
run_task({
  "phases": [{
    "launch": "com.xingin.xhs",
    "goal": "In the Xiaohongshu app, tap the Search control at the top right, tap the search field, type '<query>', and tap the Search button. Do not read the home feed: it has Following, Explore and Nearby (关注, 发现, 附近) and is not a search. After the search submits, before scrolling any card, tap Latest or 最新 in the sort row next to Top or 综合 and check that chip is selected. It sits in that row and is easy to scroll past. If you cannot see it, scroll back to the top of the results once. If it is still absent, stop and say Latest was not offered; do not collect the default sort. Then keep scrolling the note cards. Do not open a note, and do not like, collect, follow or comment.",
    "steps": ["The search field shows '<query>'",
              "Latest or 最新 is selected beside Top or 综合"],
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
      "where": "note cards from the search for '<query>' are showing, with Latest or 最新 selected",
      "count": <count>
    }
  }]
})
```

## What comes back

`result.collected` holds one record per note, with `p_organic` showing how
sure the ad judgment was. Note bodies, images and comments are on each note's
own page.

## Notes

- The search control is labelled `Search`, top right of the home feed beside
  the Following / Explore / Nearby tabs. Name it that way: an earlier goal
  said "the search icon" and the run never found anything to tap.
- This goal used to say "make sure the notes tab is active", and that one
  clause halved the collect gate. Holding the screen and the gate claim
  fixed, the gate scored 0.96 without it and 0.48 with it, because the goal
  asserted a precondition the operator could not confirm from the screen.
- Ads are labelled `Ads` or `广告` on the card, which is what the judge claim
  keys on. Marketing posts by real accounts are not ads and are kept.
- The app's language follows the account, so tabs may read 综合 / 笔记 / 用户
  or All / Notes / Users. The goal names both, and the operator matches
  whichever is on screen.
- The Latest sort is required. On 2026-10-28 a gate that only said "search
  results are showing" matched the home feed, and without Latest the notes
  were weeks old. The chip is beside Top or 综合. If it is not there, the
  run stops instead of collecting the default ranking.
- Ages come back in mixed shapes ("1 day(s) ago", "Yesterday 12:18",
  "10-14", "2024-04-11", "3天前", "昨天"). The field is the text on the
  card. The caller normalizes it; this workflow does not.
