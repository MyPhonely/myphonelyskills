---
name: youtube-video-comments
description: Read the comments under one YouTube video with author, text and like count. Use when asked what viewers are saying about a video, to gauge reaction to a launch or a topic, or to find questions people ask in the comments.
kind: workflow
title: Read the comments on a YouTube video
apps: com.google.android.youtube
writes: false
reviews: false
---

# Read the comments on a YouTube video

Finds one video in the YouTube app, opens it, scrolls to its comments and reads them: author, text, age and likes. The transcript actors on the store read what the creator said; this reads what the audience answered.

Nothing is liked, replied to or subscribed.

## Inputs

| | |
|---|---|
| **video** | the video title, or enough of it to find it, e.g. `My EB2NIW Interview Experience` |
| **count** | how many comments to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.google.android.youtube",
  "goal": "In the YouTube app, tap the search icon at the top, type '<video>', then press enter. Tap the video result whose title matches so it starts playing, then scroll down past the description until the Comments section is showing, and tap it to expand if it is collapsed. Keep scrolling the comments. Do not like, reply, subscribe or tap any other video.",
  "steps": [
    "A video with the title '<video>' is playing",
    "A list of comments with authors and comment text is showing"
  ],
  "typeTexts": [
    "<video>"
  ],
  "findTexts": [
    "Comments"
  ],
  "maxSteps": 18,
  "collect": {
    "record": "one comment under the video",
    "fields": {
      "author": "the commenter's name or handle",
      "text": "the comment text",
      "age": "how long ago it was posted, if shown",
      "likes": "the like count, if shown"
    },
    "where": "comments with authors and comment text under the video are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per top-level comment. Replies stay collapsed under 'N replies' unless the goal asks to expand them.

## Notes

- The video keeps playing while comments are read. Add 'pause the video first' to the goal if the phone's audio matters.
- Comments open as a bottom sheet on current builds. The run treats that sheet as the comments list.
