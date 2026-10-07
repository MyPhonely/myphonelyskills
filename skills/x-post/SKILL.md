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
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.twitter.android",
    "goal": "In the X app, tap the round floating button at the bottom right of the home timeline. On current builds it is labelled Post; it only opens the composer, it does not publish anything. The composer opens with a What's happening? field. Do not type, and do not tap the Post button inside the composer.",
    "allowWrites": true,
    "pauseWhen": "X's post composer is open: a 'What's happening?' field and a Post button are showing",
    "maxSteps": 6
  }]
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

`result.phases[0].sent` lists the post only when the composer closed and the timeline returned. To attach an image, push it first with `phone_push_file` and add 'tap the image icon and choose the newest photo' to the resume goal.

## Delete it

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.twitter.android",
    "goal": "In the X app, open your profile (the navigation drawer, then Profile) and find the post that begins '<first words>'. Tap that post's More (three dots) menu, tap Delete, so the confirmation shows. Delete only that post.",
    "allowWrites": true,
    "pauseWhen": "X's confirmation to delete the post that begins '<first words>' is showing",
    "maxSteps": 12
  }]
})
```

Then `resume_task({ task_id, allowWrites: true, repeat: 1, countLabel: "^Delete$", goal: "Tap Delete to confirm, once." })`.

## Notes

- **Writes are on in the first call, on purpose.** The compose button is
  labelled Post on current builds, and with writes off the operator will not
  tap anything labelled Post, so it scrolled the timeline instead (measured
  2026-10-06). Nothing is typed in the first call, so the
  composer's own Post button stays disabled.
- **Measured 2026-10-06:** composer, pause (labels showed @quickfiling2us
  and Everyone), posted and verified in 16 credits; deleted through the
  Delete it route in 18.
- X detects repeated identical posts. Vary the text between runs.
- The composer offers Drafts when it is reopened after an abandon. Nothing is saved to drafts by the abandon path; it presses Back and discards.
