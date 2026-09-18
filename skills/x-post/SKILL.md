---
name: x-post
description: Publish a new post on X (Twitter) from the signed-in account, stopping for the user to approve before it is posted. Use when asked to post, tweet or announce something on X.
kind: workflow
title: Publish a post on X, after you approve
apps: com.twitter.android
writes: true
reviews: true
---

# Publish a post on X, after you approve

Opens X's composer, stops with the phone held so you see the account it will post from, then types the text you approved and posts it, confirming by the composer closing and the post appearing rather than by the tap.

## Inputs

| | |
|---|---|
| **text** | the post, typed exactly as written; you can replace it at the pause |

## Run it

**1. Reach the point of no return, and stop.** Nothing is written here.

```json
phone_task({
  "launch": "com.twitter.android",
  "goal": "In the X app, tap the compose button, the plus or feather icon at the bottom right, so the post composer opens with the text field focused. Do not type and do not tap Post.",
  "pauseWhen": "X's post composer is open: a 'What's happening?' field and a Post button are showing",
  "maxSteps": 6
})
```

Poll until `paused`. The pause labels include the account name shown in the composer, which is the account it will post from.

**2. Show the user the text.** Wait for a yes.

**3. Post it.**

```json
resume_task({
  "task_id": "<id>",
  "text": "<text>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^post$",
  "goal": "Type the text into the focused composer field, then tap the Post button to publish it.",
  "maxSteps": 6
})
```

Poll until `done`. `resume_task({ task_id, abandon: true })` closes the composer with nothing posted.

## What comes back

`result.sent` lists the post only when the composer closed and the timeline returned. To attach an image, push it first with `phone_push_file` and add 'tap the image icon and choose the newest photo' to the resume goal.

## Notes

- X detects repeated identical posts. Vary the text between runs.
- The composer offers Drafts when it is reopened after an abandon. Nothing is saved to drafts by the abandon path; it presses Back and discards.
