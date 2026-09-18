---
name: linkedin-profile-posts
description: Read the recent posts of one LinkedIn member from their Activity, with text and reaction counts. Use when asked what someone has been posting, to research a prospect's interests before reaching out, or to track a competitor's or influencer's activity.
kind: workflow
title: Read a person's recent LinkedIn posts
apps: com.linkedin.android
writes: false
reviews: false
---

# Read a person's recent LinkedIn posts

Opens a person's profile in the LinkedIn app, goes to their Activity, and reads each recent post: the text, how old it is, and its reactions and comments. This is the input a good outreach note is written from, and it comes from the app you are signed into rather than a scraper working around LinkedIn's blocks.

Nothing is liked or commented on.

## Inputs

| | |
|---|---|
| **person** | the person's name as LinkedIn shows it |
| **context** | optional, to pick the right one in search, e.g. their company |
| **count** | how many posts to collect, default 5 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.linkedin.android",
  "goal": "In the LinkedIn app, tap the search bar at the top, type '<person> <context>', then press enter. Tap the People tab, then tap the result whose name is <person> to open their profile. Scroll down to the Activity section and tap 'Show all posts' or 'Show all activity'. Then keep scrolling the posts. Do not tap Like, Comment, Repost, Connect or Follow.",
  "steps": [
    "A profile page with the name <person> in its header is showing",
    "A list of posts by <person> is showing"
  ],
  "typeTexts": [
    "<person> <context>"
  ],
  "findTexts": [
    "<person>",
    "Show all posts",
    "Show all activity"
  ],
  "maxSteps": 22,
  "collect": {
    "record": "a post written or reposted by <person>",
    "fields": {
      "text": "the post text as far as the card shows it",
      "age": "how long ago it was posted",
      "reactions": "the reaction and comment counts, if shown",
      "kind": "whether it is an original post, a repost, or a comment on someone else's post"
    },
    "where": "a list of posts by <person> is showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per post, newest first as the app orders them.

## Notes

- The Activity section sits below About and Experience, so the run scrolls before it finds it. The `findTexts` entries let it scroll straight to the 'Show all' link.
- Members with little activity show comments and reactions in the same list. The `kind` field says which each record is.
