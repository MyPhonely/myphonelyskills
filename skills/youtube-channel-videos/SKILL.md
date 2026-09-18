---
name: youtube-channel-videos
description: List the recent uploads of one YouTube channel with title, view count and age. Use when asked what a creator has published lately, to monitor a competitor's channel, or to build a list of a channel's videos.
kind: workflow
title: List a YouTube channel's recent videos
apps: com.google.android.youtube
writes: false
reviews: false
---

# List a YouTube channel's recent videos

Opens a channel in the YouTube app, switches to its Videos tab, and reads each card: title, view count, age and length. Signed in as you, so members-only and unlisted-in-search content the channel shows you is included.

Nothing is watched, liked or subscribed to.

## Inputs

| | |
|---|---|
| **channel** | the channel name or handle, e.g. `EB2 w/ Estela` |
| **count** | how many videos to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.google.android.youtube",
  "goal": "In the YouTube app, tap the search icon at the top, type '<channel>', then press enter. Tap the channel result named <channel> so the channel page opens, then tap its Videos tab. Keep scrolling the videos. Do not open a video, do not subscribe, like or comment.",
  "steps": [
    "A channel page named <channel> is showing",
    "A list of videos from <channel> is showing"
  ],
  "typeTexts": [
    "<channel>"
  ],
  "findTexts": [
    "Videos"
  ],
  "maxSteps": 16,
  "collect": {
    "record": "a video on the channel's Videos tab",
    "fields": {
      "title": "the video title",
      "views": "the view count, if shown",
      "age": "how long ago it was posted, if shown",
      "length": "the video length, if shown"
    },
    "where": "a list of video results from <channel> is showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per video, newest first as the tab orders them.

## Notes

- Result cards carry the title as a label and often bundle views, age and length into the same card text, so those fields may come back inside `title` rather than separately.
- Shorts live on their own tab. Say 'tap the Shorts tab' in the goal to read those instead.
