---
name: x-profile-posts
description: Read the recent posts of one X (Twitter) account with text, age and engagement. Use when asked what someone has been posting on X, to monitor a competitor, official account or influencer, or to gather a person's recent statements.
kind: workflow
title: Read an account's recent posts on X
apps: com.twitter.android
writes: false
reviews: false
---

# Read an account's recent posts on X

Opens an account's profile in the X app and reads its timeline: each post's text, how old it is, and its reply, repost and like counts. Signed in as you, so a protected account you follow reads like any other.

Nothing is liked, reposted, replied to or followed.

## Inputs

| | |
|---|---|
| **handle** | the account's @handle, e.g. `@USCIS` |
| **handle_bare** | the same without the @, for the URL, e.g. `USCIS` |
| **count** | how many posts to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.twitter.android",
  "openUrl": "https://x.com/<handle_bare>",
  "goal": "The X app is showing the profile of <handle>. Keep scrolling down the profile's posts. Do not like, repost, reply, follow or open any post.",
    "maxSteps": 16,
  "collect": {
    "record": "a post on the profile's timeline",
    "fields": {
      "text": "the post text",
      "age": "how long ago it was posted",
      "engagement": "the reply, repost and like counts, if shown",
      "kind": "whether it is an original post, a repost, or a reply"
    },
    "where": "posts by <handle> are showing on the profile page",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per post, newest first, including pinned posts at the top.

## Notes

- Profiles open on the Posts tab. Say 'tap the Replies tab' or 'tap Media' in the goal for those instead.
- `openUrl` opens the profile by deep link before the first step, as a procedure rather than a choice: asked to pick `open_url` itself, the operator scrolled the home feed instead. X handles `x.com/<name>` links in the app.
