---
name: x-collect-topic
description: Collect recent posts about a topic from X, with their authors, filtered by what the topic actually means. Use when asked to gather, monitor, summarise or report on what people are posting on X or Twitter about a subject.
kind: workflow
title: Collect posts about a topic on X
apps: com.twitter.android
writes: false
reviews: false
---

# Collect posts about a topic on X

Searches X from the phone's signed-in account, sorts by Latest, and reads the
results while scrolling. Each post is scored against a claim you write, so a
search for a term with an everyday meaning still returns the posts you meant.
Because it runs in the app as the signed-in account, it sees what that account
sees, including posts from protected accounts it follows.

## Inputs

| | |
|---|---|
| **topic** | what to search for, typed into X exactly as given, e.g. `EB-2 NIW` |
| **claim** | what a post you want is, as a statement about one post, e.g. "the post is about the EB-2 NIW immigration visa, not the letters used casually" |
| **count** | how many matching posts to collect, default 5 |
| **bar** | how sure the claim must be, 0 to 1, default 0.7 |

## Run it

One call. Substitute the inputs into the goal and the collect spec.

```json
phone_task({
  "launch": "com.twitter.android",
  "goal": "In the X app, tap the Explore or Search tab, tap the search field, type '<topic>', and submit the search. On the results screen tap the Latest tab so the newest posts are showing, then keep scrolling down the results. Do not like, repost, reply, follow or open any post.",
  "steps": ["The X app is open",
            "Search results for '<topic>' are showing",
            "The Latest tab of the results is selected"],
  "typeTexts": ["<topic>"],
  "maxSteps": 14,
  "collect": {
    "record": "a post in the search results",
    "fields": { "author": "the display name or @handle of the account that posted it",
                "text": "the post's text" },
    "judge":  { "on_topic": "<claim>" },
    "require": { "on_topic": <bar> },
    "where": "a list of posts about '<topic>' is showing",
    "count": <count>
  }
})
```

Then poll `get_task_status(task_id, wait_seconds: 30)` until the status is
`done`.

## What comes back

`result.collected` holds one record per post: `author`, `text`, and
`p_on_topic`, the probability the claim held. Sort or filter on that
probability if you want to be stricter than the bar.

## Notes

- Zero records from a search with nothing matching is a correct answer, not a
  failure. Do not rerun with a looser claim unless asked.
- X caps how far search results scroll. For more than about thirty posts,
  split the topic into narrower searches rather than raising `count`.
- The same shape works in any app with a search and a feed. Change `launch`,
  the labels named in the goal, and what one record is.
