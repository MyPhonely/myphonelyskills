---
name: x-find-review-reply
description: Find the newest post on X about a topic, open its reply box, stop for the user to approve, then post the comment. Use when asked to reply to, comment on, or engage with posts on X or Twitter, especially when the user should see the post before anything is written.
kind: workflow
title: Find a post on X and reply, after you approve
apps: com.twitter.android
writes: true
reviews: true
---

# Find a post on X and reply, after you approve

The half of phone automation an API cannot do. It searches X as the signed-in
account, picks the newest post genuinely about the topic, opens that post's
reply composer, and stops there holding the phone. The user sees which post it
chose before anything is written. On approval it types the comment and posts
it, then confirms the reply landed by the composer closing rather than by the
tap.

## Inputs

| | |
|---|---|
| **topic** | what to search for on X, e.g. `EB-2 NIW` |
| **about** | what makes a post the right one, in a few words, e.g. "genuinely about the EB-2 NIW visa" |
| **comment** | the reply, typed exactly as written; nothing else is ever typed |

If the user has not written the comment, draft it and show it to them before
the second call, never before the first.

## Run it

**1. Find the post and open its reply box.** Nothing is written here.

```json
phone_task({
  "launch": "com.twitter.android",
  "goal": "In the X app, tap the Explore or Search tab, tap the search field, type '<topic>', and submit. On the results screen tap the Latest tab. Then, on the first post in the results that is <about>, tap the Reply button that belongs to that post — the Reply in the same card as its text, not the post text itself — so the reply composer opens for it. Do not type, post, like, repost or follow.",
  "typeTexts": ["<topic>"],
  "pauseWhen": "X's reply composer is open: a 'Replying to @…' line and a 'Post your reply' field are showing, with the keyboard up",
  "maxSteps": 16
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is
`paused`. The pause carries `context.labels`, which include the
`Replying to @…` line, so you can tell the user whose post it picked.

**2. Show the user the post and the comment.** Wait for a yes.

**3. Post it.**

```json
resume_task({
  "task_id": "<id>",
  "text": "<comment>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(reply|post)$",
  "goal": "Type the comment into the focused reply field, then tap the Reply button to post it. Do not like, repost or follow.",
  "maxSteps": 8
})
```

Poll until `done`. To walk away instead, call
`resume_task({ task_id, abandon: true })`: the composer is closed, the phone
released, and nothing is posted.

## What comes back

`result.sent` lists the reply only when its effect was verified on screen, the
composer closing and the thread returning. Report that, not the tap. An
unanswered pause expires after ten minutes and the phone is released.

## Notes

- Never skip the pause on a fresh account or an unfamiliar topic. The post it
  picked is the thing most worth a human glance.
- X detects repeated identical replies. Write each comment from the post it
  found, and keep batches small.
- Same shape for any app where you find something and then act on it. Change
  the app, the labels in the goal, and the pause condition.
