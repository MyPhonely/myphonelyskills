---
name: tiktok-search-videos
description: Search TikTok for videos about a topic and collect the caption, creator and engagement of each. Use when asked what is trending on TikTok about a subject, to find creators posting about a topic, or to gather video captions for research.
kind: workflow
title: Collect TikTok videos about a topic
apps: com.zhiliaoapp.musically
writes: false
reviews: false
---

# Collect TikTok videos about a topic

Searches TikTok in the app and reads the results: each video's caption, the creator's handle, and the view or like counts where the card shows them. The TikTok scraper is the store's second most-run actor; the phone version reads the same captions and creators, without the video itself.

Nothing is liked, followed, commented on or watched to the end.

## Inputs

| | |
|---|---|
| **query** | what to search for, e.g. `EB2 NIW` |
| **count** | how many videos to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.zhiliaoapp.musically",
  "goal": "In the TikTok app, the For You feed may show a 'Something went wrong / Try again later' message with a Retry button; that message is harmless and does not block search, so ignore it and do not tap Retry. Tap the Search icon at the top right, tap the search field, type '<query>', and submit. On the results, tap the Videos tab if one is offered, then keep scrolling the results. Do not open a video, do not like, follow or comment.",
  "steps": [
    "Search results for '<query>' are showing",
    "A list of video results about '<query>' with captions is showing"
  ],
  "typeTexts": [
    "<query>"
  ],
  "maxSteps": 16,
  "collect": {
    "record": "a video in the search results",
    "fields": {
      "caption": "the video's caption or title text",
      "creator": "the creator's name or handle",
      "stats": "the view or like count, if shown",
      "age": "how long ago it was posted, if shown"
    },
    "where": "video results about '<query>' with captions are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per video card. Comments and the full caption are on each video's own page.

## Notes

- **Unverified, 2026-09-18.** On the phone we test on, TikTok cannot load content at all: the feed and the search results both show 'Something went wrong / Try again later', and Retry does not clear it. The search screen itself opens and accepts a query, so the route is right as far as the app allows; the listing stays until it can be run on a phone where TikTok works.

- TikTok has no app playbook on the server yet, so the operator works from the live screen alone here. Expect it to spend a step or two more finding the search control than apps with a playbook.
- On this phone TikTok's feed opens to 'Something went wrong / Try again later'. Retry does not clear it, but Search works regardless, so the goal says the message is harmless; without that sentence the operator reads it as a wall and stops.
- The app opens on the For You feed with a video playing. The launch step force-stops and reopens it, which lands on the feed each time.
