---
name: linkedin-post
description: Publish a new post on LinkedIn from the signed-in account, stopping for the user to approve before it is posted. Use when asked to post or share an update on LinkedIn.
kind: workflow
title: Publish a post on LinkedIn, after you approve
apps: com.linkedin.android
writes: true
reviews: true
---

# Publish a post on LinkedIn, after you approve

Opens LinkedIn's post composer, stops with the phone held so you see the account and audience it will post as, then types the text you approved and posts it, confirming by the composer closing and the feed returning.

## Inputs

| | |
|---|---|
| **text** | the post, typed exactly as written; you can replace it at the pause |

## Run it

**1. Reach the point of no return, and stop.** Nothing is written here.

```json
phone_task({
  "launch": "com.linkedin.android",
  "goal": "In the LinkedIn app, tap the Post button in the bottom navigation, or the 'Start a post' field at the top of the home feed, so the post composer opens with its text field focused. Do not type and do not tap Post.",
  "pauseWhen": "LinkedIn's post composer is open: a 'Share your thoughts' or 'What do you want to talk about?' field and a Post button are showing",
  "maxSteps": 6
})
```

Poll until `paused`. The pause labels include the audience selector, usually 'Anyone', so you can see who will see it.

**2. Show the user the text.** Wait for a yes.

**3. Post it.**

```json
resume_task({
  "task_id": "<id>",
  "text": "<text>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^post$",
  "goal": "Type the text into the focused composer field, then tap the Post button at the top right to publish it.",
  "maxSteps": 6
})
```

Poll until `done`. `resume_task({ task_id, abandon: true })` closes the composer with nothing posted.

## What comes back

`result.sent` lists the post only when the composer closed and the feed returned. The Post button on LinkedIn is both the composer opener and the publisher; the operator's commit judgment tells them apart, which is why the first call can tap one and not the other.

## Notes

- LinkedIn's composer may show 'Discard post?' on Back after text is typed. The abandon path presses Back before anything is typed, so it does not.
- To attach media, push the file first with `phone_push_file` and add 'tap the photo icon and choose the newest image' to the resume goal.
