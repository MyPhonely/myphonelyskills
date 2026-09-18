---
name: linkedin-post-search
description: Search LinkedIn for posts about a topic and collect the author, text and reaction count of each. Use when asked what people are saying about a subject on LinkedIn, to find posts to engage with, or to monitor a topic there.
kind: workflow
title: Search LinkedIn posts by keyword
apps: com.linkedin.android
writes: false
reviews: false
---

# Search LinkedIn posts by keyword

Runs a keyword search in the LinkedIn app, switches the results to Posts, and reads each post card: who wrote it, the text as shown, how old it is, and its reaction and comment counts. Signed in as you, so the ranking is the one your account gets, including posts from your network that a logged-out search never returns.

Nothing is liked, commented on or reposted.

## Inputs

| | |
|---|---|
| **query** | what to search for, e.g. `EB-2 NIW` |
| **count** | how many posts to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.linkedin.android",
  "goal": "In the LinkedIn app, tap the search bar at the top, type '<query>', then press enter. Tap the Posts tab so post results are listed, then keep scrolling the posts. Do not open a post, do not tap Like, Comment, Repost, Send or Follow.",
  "steps": [
    "Search results for '<query>' are showing",
    "A list of posts with authors and post text is showing"
  ],
  "typeTexts": [
    "<query>"
  ],
  "maxSteps": 18,
  "collect": {
    "record": "a post in the Posts search results",
    "fields": {
      "author": "the name of the account that posted it",
      "headline": "the author's headline line, if shown",
      "text": "the post text as far as the card shows it",
      "age": "how long ago it was posted",
      "reactions": "the reaction and comment counts, if shown"
    },
    "where": "a list of posts about '<query>' with their authors is showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per post. Long posts are cut at the card's 'see more'; open the post with a second task when you need all of it.

## Notes

- Search opens on Jobs on current builds, so the goal names the Posts tab. If the run reports zero records, check the first steps in `progress` for whether that tap landed.
- Promoted posts appear in the list. A `judge` claim of 'the post is organic, not labelled Promoted' filters them.
