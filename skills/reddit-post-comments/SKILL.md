---
name: reddit-post-comments
description: Read the comment thread under one Reddit post with author, text and score. Use when asked what people replied to a post, to gather answers to a question asked on Reddit, or to summarise a discussion.
kind: workflow
title: Read the comments on a Reddit post
apps: com.reddit.frontpage
writes: false
reviews: false
---

# Read the comments on a Reddit post

Finds one post in the Reddit app, opens it, and reads the comments below it: author, text, score and age. Signed in as you, so posts in private communities you belong to read the same as public ones.

Nothing is upvoted, commented on or joined.

## Inputs

| | |
|---|---|
| **subreddit** | the community the post is in, e.g. `r/immigration` |
| **post** | the post's title, or enough of it to find it |
| **count** | how many comments to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.reddit.frontpage",
  "goal": "In the Reddit app, tap the search bar at the top labelled 'Find anything', type '<post>', press enter, and tap the post result whose title matches, from <subreddit>. On the post page, scroll down past the post body to the comments and keep scrolling them. Do not tap the Ask button, do not upvote, reply, share or join.",
  "steps": [
    "A post page whose title is '<post>' is showing",
    "Comments under the post, with authors and comment text, are showing"
  ],
  "typeTexts": [
    "<post>"
  ],
  "findTexts": [
    "<post>"
  ],
  "maxSteps": 20,
  "collect": {
    "record": "one comment under the post",
    "fields": {
      "author": "the commenter's username",
      "text": "the comment text",
      "score": "the vote count, if shown",
      "age": "how long ago it was posted, if shown"
    },
    "where": "comments under the post '<post>' are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per visible comment. Nested replies appear in thread order; collapsed threads stay collapsed unless the goal asks to expand them.

## Notes

- Reddit's search bar has an Ask button that opens its AI answers rather than search. The goal forbids it; it is the main trap in this app.
- Comment text on current builds is exposed as content descriptions, so the author and text may arrive in one string.
