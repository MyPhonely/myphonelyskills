---
name: xiaohongshu-note-comments
description: Read the comments under one Xiaohongshu (RedNote) note with author, text and likes. Use when asked what people said about a note, to gather reactions to a product or topic on Xiaohongshu, or to find questions asked under a post.
kind: workflow
title: Read the comments on a Xiaohongshu note
apps: com.xingin.xhs
writes: false
reviews: false
---

# Read the comments on a Xiaohongshu note

Finds one note in the Xiaohongshu app by its words, opens it, opens its comment sheet and reads the comments: author nickname, text, likes and age. The comments actor for this app is one of the store's rising ones; here it is the app, signed in, reading its own comment sheet.

Nothing is liked, collected, followed or commented.

## Inputs

| | |
|---|---|
| **words** | distinctive words from the note's title, to find it, e.g. `18个引用获批NIW` |
| **count** | how many comments to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.xingin.xhs",
  "goal": "In the Xiaohongshu app, tap the Search control at the top right, type '<words>', and submit. Tap the note whose title matches so it opens. On the note, tap the comment bubble icon at the bottom so the comment sheet opens, then keep scrolling the comments. Do not like, collect, follow, or type anything.",
  "steps": [
    "A note whose title contains '<words>' is open",
    "A sheet of comments with author nicknames and comment text is showing"
  ],
  "typeTexts": [
    "<words>"
  ],
  "maxSteps": 18,
  "collect": {
    "record": "one comment in the note's comment sheet",
    "fields": {
      "author": "the commenter's nickname",
      "text": "the comment text",
      "likes": "the like count, if shown",
      "age": "how long ago it was posted, if shown"
    },
    "where": "comments on the note about '<words>' are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per comment, including the author's own replies marked as 作者 where the app shows that.

## Notes

- The comment sheet has a 'Say something' input at the bottom. The goal forbids typing, and the write gate refuses the 发布 button without `allowWrites`.
- Do not put 'make sure the notes tab is active' or similar preconditions in the goal; on this app that one clause halved the collect gate.
