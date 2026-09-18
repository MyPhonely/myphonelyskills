---
name: youtube-collect-search
description: Collect videos from a YouTube search with title, channel, view count and age. Use when asked to find videos on a topic, track what a niche is publishing, research creators, or gather recent uploads matching a query.
kind: workflow
title: Collect videos from a YouTube search
apps: com.google.android.youtube
writes: false
reviews: false
---

# Collect videos from a YouTube search

Searches YouTube in the app, switches to the Videos tab so channels and
playlists do not clutter the list, and reads each result: title, channel, view
count and age. Signed in as you, so age-restricted and members-only results
appear the way they do for your account.

Nothing is watched, liked or subscribed to.

## Inputs

| | |
|---|---|
| **query** | what to search for, e.g. `EB-2 NIW interview` |
| **count** | how many videos to collect, default 10 |

## Run it

```json
phone_task({
  "launch": "com.google.android.youtube",
  "goal": "In the YouTube app, tap the search icon at the top, type '<query>', and submit. On the results screen tap the Videos filter tab so only videos are listed, then keep scrolling the results. Do not open a video, do not subscribe, like or comment.",
  "steps": ["YouTube is open",
            "Search results for '<query>' are showing",
            "The Videos tab is active"],
  "typeTexts": ["<query>"],
  "maxSteps": 14,
  "collect": {
    "record": "a video in the search results",
    "fields": { "title": "the video title",
                "channel": "the channel name",
                "views": "the view count, if shown",
                "age": "how long ago it was posted, if shown",
                "length": "the video length, if shown" },
    "where": "the Videos tab of the search results is showing",
    "count": <count>
  }
})
```

## What comes back

`result.collected` holds one record per video. Descriptions, comments and exact
upload dates are on each video's page, which is a separate task per video.

## Notes

- The first result or two can be ads. They are labelled on screen, and a
  `judge` claim such as "the result is an organic video, not an ad" filters
  them when it matters.
- To collect from one channel instead of a search, change the goal to open the
  channel and its Videos tab, and keep the same collect spec.
