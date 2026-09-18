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
| **group** | the group name as it appears in your groups, e.g. `Seattle Homeowners` |
| **count** | how many posts to collect, default 10 |
| **claim** | optional filter, a statement about one post, e.g. "the post is someone asking for a recommendation" |

## Run it

```json
phone_task({
  "launch": "com.facebook.katana",
  "goal": "In the Facebook app, tap the search icon, type '<group>', submit, and open the group named <group> from the results. On the group feed, keep scrolling the posts. Do not tap 'Write something', do not like, comment, share or join anything.",
  "steps": ["Facebook is open",
            "The <group> group feed is showing"],
  "typeTexts": ["<group>"],
  "maxSteps": 20,
  "collect": {
    "record": "a post in the group feed",
    "fields": { "author": "who posted it",
                "text": "the post text, as far as the card shows it",
                "age": "how long ago it was posted",
                "engagement": "the reaction and comment counts, if shown" },
    "where": "a feed of posts from the <group> group is showing",
    "count": <count>
  }
})
```

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
