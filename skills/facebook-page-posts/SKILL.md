---
name: facebook-page-posts
description: Read the recent posts of one Facebook page with text, age and reaction counts. Use when asked what a business, organisation or public figure has posted on Facebook, to monitor a competitor's page, or to gather announcements from an official page.
kind: workflow
title: Read a Facebook page's recent posts
apps: com.facebook.katana
writes: false
reviews: false
---

# Read a Facebook page's recent posts

Finds a page in the Facebook app, opens it, and reads its feed: each post's text as shown, how old it is, and the reaction and comment counts. The Facebook search scraper on the store works around a site that blocks it; here it is the app, signed in.

Nothing is liked, commented on, shared or followed.

## Inputs

| | |
|---|---|
| **page** | the page name as Facebook shows it, e.g. `USCIS` |
| **count** | how many posts to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.facebook.katana",
  "goal": "In the Facebook app, tap the search icon, type '<page>', submit, and open the page named <page> from the results, choosing the Pages result over people or groups. On the page, scroll down to its posts and keep scrolling them. Do not like, comment, share, follow or message.",
  "steps": [
    "A page named <page> is showing",
    "A feed of posts from the <page> page is showing"
  ],
  "typeTexts": [
    "<page>"
  ],
  "findTexts": [
    "<page>"
  ],
  "maxSteps": 20,
  "collect": {
    "record": "a post on the page's feed",
    "fields": {
      "text": "the post text as far as the card shows it",
      "age": "how long ago it was posted",
      "engagement": "the reaction and comment counts, if shown"
    },
    "where": "a feed of posts from the <page> page is showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per post. Long posts are cut at 'See more'; open one with a second task for the full text.

## Notes

- Pages with the same name as a group or a person appear together in search. The goal says to choose the Pages result; if the run opens the wrong thing, add the page's category or location to the goal.
- Facebook inserts suggested posts into page feeds on some builds. A `judge` claim of 'the post was written by the page itself' filters them.
