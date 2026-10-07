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
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.linkedin.android",
    "goal": "In the LinkedIn app, tap the Post button in the bottom navigation, or the 'Start a post' field at the top of the home feed, so the post composer opens. That button only opens the composer; it does not publish. Do not type and do not tap the Post button inside the composer.",
    "allowWrites": true,
    "pauseWhen": "LinkedIn's post composer is open: a 'Share your thoughts' or 'What do you want to talk about?' field and a Post button are showing",
    "maxSteps": 6
  }]
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

`result.phases[0].sent` lists the post only when the composer closed and the feed returned. The Post button on LinkedIn is both the composer opener and the publisher; the operator's commit judgment tells them apart, which is why the first call can tap one and not the other.

## Delete it

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.linkedin.android",
    "goal": "In the LinkedIn app, open your profile, then its Activity or Posts, and find the post that begins '<first words>'. Tap that post's three-dot menu, tap Delete post, so the confirmation shows. Delete only that post.",
    "allowWrites": true,
    "pauseWhen": "LinkedIn's confirmation to delete the post that begins '<first words>' is showing",
    "maxSteps": 14
  }]
})
```

Then `resume_task({ task_id, allowWrites: true, repeat: 1, countLabel: "^Delete$", goal: "Tap Delete to confirm, once." })`.

## Notes

- **Not working on 2026-10-06: the text never lands in the composer.** The
  backend types by switching to the MyPhonely keyboard and back; LinkedIn's
  post composer loses focus on that switch, so the field keeps its
  placeholder and Post stays disabled (nothing is published). The same
  switch likely explains LinkedIn's search box stalling. Fixing it is a
  backend change to typing.
- **Writes are on in the first call** because the composer opener is
  labelled Post; with writes off the operator will not tap it. Nothing is
  typed there, so the composer's own Post stays disabled.
- Tapping the audience label (Anyone) on this build opened Add
  collaborators instead of the audience choice; the goal leaves the audience
  alone.
- LinkedIn's composer may show 'Discard post?' on Back after text is typed. The abandon path presses Back before anything is typed, so it does not.
- To attach media, push the file first with `phone_push_file` and add 'tap the photo icon and choose the newest image' to the resume goal.
