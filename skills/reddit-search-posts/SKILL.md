---
name: reddit-search-posts
description: Search Reddit across all communities for posts about a topic, with title, community, age and score. Use when asked where a subject is being discussed on Reddit, to find threads to join, or to gather posts on a topic regardless of subreddit.
kind: workflow
title: Search Reddit for posts about a topic
apps: com.reddit.frontpage
writes: false
reviews: false
---

# Search Reddit for posts about a topic

Runs a search in the Reddit app, keeps the results on Posts, and reads each result: title, which community, how old, and the vote and comment counts. Where the subreddit workflow reads one community, this reads across all of them.

Nothing is upvoted, commented on or joined.

## Inputs

| | |
|---|---|
| **query** | what to search for, e.g. `NIW RFE` |
| **count** | how many posts to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.reddit.frontpage",
  "goal": "In the Reddit app, tap the search bar at the top labelled 'Find anything', type '<query>', and press enter. On the results, tap the Posts tab so only posts are listed, then keep scrolling the results. Do not tap the Ask button, do not open a post, and do not upvote, comment or join.",
  "steps": [
    "Search results for '<query>' are showing",
    "A list of post results about '<query>' is showing"
  ],
  "typeTexts": [
    "<query>"
  ],
  "maxSteps": 20,
  "collect": {
    "record": "a post in the search results",
    "fields": {
      "title": "the post title",
      "community": "the r/ community it was posted in",
      "age": "how long ago it was posted",
      "score": "the vote and comment counts, if shown"
    },
    "where": "a list of posts about '<query>' is showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per post. Add a `judge` claim to keep only the posts that match what you mean by the topic.

## Notes

- Reddit shows one tall card per screen, so ten posts is roughly ten screens and `maxSteps` is 20.
- The Ask button beside the search bar is Reddit Answers, not search. Never tap it.
