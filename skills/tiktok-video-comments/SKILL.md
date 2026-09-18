---
name: tiktok-video-comments
description: Read the comments under one TikTok video with author, text and likes. Use when asked how viewers reacted to a TikTok, to gather questions or opinions from its comments, or to research audience sentiment about a creator's video.
kind: workflow
title: Read the comments on a TikTok video
apps: com.zhiliaoapp.musically
writes: false
reviews: false
---

# Read the comments on a TikTok video

Finds one TikTok video by its creator and caption words, opens it, opens the comment sheet, and reads the comments: author, text, likes and age.

Nothing is liked, replied to or followed.

## Inputs

| | |
|---|---|
| **creator** | the creator's @handle |
| **words** | distinctive words from the caption, to find the video |
| **count** | how many comments to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.zhiliaoapp.musically",
  "goal": "In the TikTok app, the For You feed may show a 'Something went wrong / Try again later' message with a Retry button; that message is harmless and does not block search, so ignore it and do not tap Retry. Tap the Search icon at the top right, tap the search field, type '<creator> <words>', and submit. Tap the matching video so it plays full screen, then tap the comment bubble icon on the right side so the comment sheet opens. Keep scrolling the comments. Do not like, reply, follow or swipe to another video.",
  "steps": [
    "A video by <creator> is playing full screen",
    "A sheet of comments with authors and comment text is showing"
  ],
  "typeTexts": [
    "<creator> <words>"
  ],
  "maxSteps": 18,
  "collect": {
    "record": "one comment in the video's comment sheet",
    "fields": {
      "author": "the commenter's name or handle",
      "text": "the comment text",
      "likes": "the like count, if shown",
      "age": "how long ago it was posted, if shown"
    },
    "where": "comments on the video by <creator> are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per top-level comment. Replies are collapsed under 'View N replies' unless the goal asks to expand them.

## Notes

- **Unverified, 2026-09-18.** On the phone we test on, TikTok cannot load content at all: the feed and the search results both show 'Something went wrong / Try again later', and Retry does not clear it. The search screen itself opens and accepts a query, so the route is right as far as the app allows; the listing stays until it can be run on a phone where TikTok works.

- A vertical swipe on the video moves to the next video. The goal forbids it, and the operator does not offer scrolls while the comment sheet is what the goal describes.
- No app playbook for TikTok yet; the run works from the screen alone.
