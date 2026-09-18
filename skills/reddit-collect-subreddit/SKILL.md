---
name: reddit-collect-subreddit
description: Collect posts from a subreddit, sorted how you choose, with title, age, upvotes and comment count. Use when asked to monitor a subreddit, gather what a community is discussing, track a topic on Reddit, or pull recent posts from r/something.
kind: workflow
title: Collect posts from a subreddit
apps: com.reddit.frontpage
writes: false
reviews: false
---

# Collect posts from a subreddit

Opens a subreddit in the Reddit app, sets the sort you asked for, and reads
the post cards while scrolling: title, how long ago, upvotes and comments.
Signed in as you, so it also reaches communities that require membership and
posts that are hidden from logged-out visitors.

## Inputs

| | |
|---|---|
| **subreddit** | the community, e.g. `r/immigration` |
| **sort** | `New`, `Hot` or `Top`, default `New` |
| **count** | how many posts to collect, default 10 |
| **claim** | optional filter, a statement about one post, e.g. "the post is a policy update, not a personal case question" |

## Run it

```json
phone_task({
  "launch": "com.reddit.frontpage",
  "goal": "In the Reddit app, tap the search bar at the top labelled 'Find anything', type '<subreddit>', press enter, and tap the community result for <subreddit>, not a post. On the subreddit feed, tap the sort label under the header and choose <sort>. Then keep scrolling the post list. Do not tap the Ask button, do not open a post, and do not upvote, comment or join.",
  "steps": ["Reddit is open",
            "The <subreddit> community feed is showing",
            "The feed is sorted by <sort>"],
  "typeTexts": ["<subreddit>"],
  "maxSteps": 24,
  "collect": {
    "record": "a post in the subreddit feed",
    "fields": { "title": "the post title",
                "age": "how long ago it was posted",
                "upvotes": "the upvote count, if shown",
                "comments": "the comment count, if shown" },
    "where": "a list of posts with titles and vote counts is showing",
    "count": <count>
  }
})
```

With **claim**, add `"judge": {"wanted": "<claim>"}` and
`"require": {"wanted": 0.7}` to the collect spec, and each record comes back
with `p_wanted` as well.

## What comes back

`result.collected` holds one record per post. Post bodies and comment threads
are on each post's own page; open one with a second task when a title is worth
following.

## Notes

- Reddit shows one tall card per screen, which is why `maxSteps` is 24 here
  rather than the usual 14. Ten posts is roughly ten screens.
- The search bar has an **Ask** button that opens Reddit's AI answers, not
  search. The goal forbids it; the playbook calls it out as the main trap in
  this app.
- Sorting by **Top** also has a time range next to it. If you need "top this
  week", say so in the goal and the operator will set both.
