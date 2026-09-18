---
name: x-post-replies
description: Read the replies under one post on X (Twitter) with author, text and engagement. Use when asked how people responded to a post, to gauge reaction to an announcement, or to find questions asked under a thread.
kind: workflow
title: Read the replies to a post on X
apps: com.twitter.android
writes: false
reviews: false
---

# Read the replies to a post on X

Finds one post on X by its author and some of its words, opens it, and reads the replies beneath: who replied, what they said, and the engagement on each reply.

Nothing is liked, reposted, replied to or followed.

## Inputs

| | |
|---|---|
| **handle** | the @handle of the post's author |
| **words** | a few distinctive words from the post, to find it |
| **count** | how many replies to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.twitter.android",
  "goal": "In the X app, tap the Explore or Search tab, tap the search field, type 'from:<handle> <words>', and press enter. Tap the Latest tab, then tap the text of the matching post so it opens on its own page. Scroll down past the post to the replies and keep scrolling them. Do not like, repost, reply or follow.",
  "steps": [
    "A single post by <handle> is open on its own page",
    "Replies under the post, with authors, are showing"
  ],
  "typeTexts": [
    "from:<handle> <words>"
  ],
  "maxSteps": 18,
  "collect": {
    "record": "one reply under the post",
    "fields": {
      "author": "the replier's name or handle",
      "text": "the reply text",
      "age": "how long ago it was posted",
      "engagement": "the reply's like and reply counts, if shown"
    },
    "where": "replies under the post by <handle> are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per reply in the order X shows them, which is by relevance unless the goal asks for latest.

## Notes

- The `from:` search operator works in the app's search box and narrows results to that author, which is what makes the post findable.
- Replies from accounts X hides as low quality sit behind 'Show more replies'. Ask for it in the goal if you want them.
