---
name: facebook-collect-group-posts
description: Collect recent posts from a Facebook group you belong to, with author, text and engagement. Use when asked to monitor a Facebook group, gather what a community is posting, or track discussions in a private or members-only group.
kind: workflow
title: Collect posts from a Facebook group
apps: com.facebook.katana
writes: false
reviews: false
---

# Collect posts from a Facebook group

Opens a group you are a member of and reads the feed while scrolling: who
posted, the text, how long ago, and the reaction and comment counts.

Private groups are the point. Their content is not on the open web at all, so
no scraper reaches it; membership is the key, and the phone is already signed
in with yours.

Nothing is posted, commented, liked or joined.

## Inputs

| | |
|---|---|
| **group** | the group name as it appears in your groups, e.g. `Seattle Homeowners`; or `all` for the combined feed of every group you belong to |
| **count** | how many posts to collect, default 10 |
| **claim** | optional filter, a statement about one post, e.g. "the post is someone asking for a recommendation" |

## Run it

One group, opened from the Menu's list of your groups (typing the name
into search is the less reliable route):

```json
run_task({
  "phases": [{
    "launch": "com.facebook.katana",
    "goal": "In the Facebook app, tap Menu at the top left, then tap the group named '<group>' in the groups list there (scroll the list if needed). In the group, scroll down the feed and read the posts. Do not open any post or its comments, do not tap 'Write something', and do not like, comment, share or join anything.",
    "findTexts": ["<group>"],
    "maxSteps": 16,
    "collect": {
      "record": "a post in the group feed: one member's post card with its author name, its age (like 4h or 2d) and its text. Facebook labels a post's Like button 'react to the comment', but these are posts, not comments",
      "fields": { "author": "the post's author",
                  "text": "the post text, as far as the card shows it",
                  "age": "how long ago it was posted, e.g. 30m, 4h, 2d",
                  "engagement": "the reaction and comment counts, if shown" },
      "where": "a Facebook group's feed of posts is showing",
      "count": <count>
    }
  }]
})
```

**All your groups at once** (`group: all`): the same call with the goal
"In the Facebook app, tap Menu, then Groups, and stay on the feed of posts
from your groups (not Discover, not Your groups' list). Scroll it and read
the posts…", a `group` field added ("the group the post is in, shown on
the card"), and `where` "Facebook's feed of posts from your groups is
showing". One read covers every group, but Facebook ranks it, so read the
groups that matter most on their own feeds too.

With **claim**, add `"judge": {"wanted": "<claim>"}` and
`"require": {"wanted": 0.7}` to the collect spec.

## What comes back

`result.collected` holds one record per post. Long posts are truncated on the
card behind a "See more" link, so `text` is the visible part; open the post
with a second task when you need all of it.

## Notes

- You must already be a member. This workflow does not join groups, and a
  request to join is a write the gate refuses.
- Facebook mixes suggested posts and ads into group feeds on some builds. A
  `claim` of "the post was written by a group member, not a suggested post or
  an ad" filters them.
- The same shape reads a Page's feed: name the page instead of the group.
- **`where` must not name the group.** Measured 2026-10-12: with "a feed of
  posts from the <group> group is showing", the name scrolled off the top
  and nothing was collected for 22 steps; a record that just said "a post"
  collected one post and six replies under it. The spec above collected
  posts; Facebook's tall cards still give only a few per read, about 35
  credits each.
