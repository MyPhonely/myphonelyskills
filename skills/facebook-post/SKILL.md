---
name: facebook-post
description: Publish a Facebook post on your profile or in a group you belong to, choosing who can see it, stopping for the user to approve before it is posted, and delete it again if needed. Use when asked to post or share something on Facebook.
kind: workflow
title: Publish a Facebook post, after you approve
apps: com.facebook.katana
writes: true
reviews: true
---

# Publish a Facebook post, after you approve

Opens Facebook's composer from "What's on your mind?" on your feed (or
"Write something…" in a group) and stops with the phone held, so you see
the identity and the audience it will post with. On approval it types the
post, sets the audience if asked, and taps Post (via Next on builds that
show it) once.

## Inputs

| | |
|---|---|
| **text** | the post, typed exactly as written |
| **where** | `profile`, or a group's link (`https://www.facebook.com/groups/...`) |
| **audience** | for a profile post: `public`, `friends` or `only me`; default as the account is set |

## Run it

**1. Open the composer.** Nothing is written.

```json
run_task({
  "phases": [{
    "launch": "com.facebook.katana",
    "goal": "In the Facebook app, on the home feed tap the 'What's on your mind?' field so the post composer opens. Do not tap Create story or Create reel. Do not type and do not tap Post or Next.",
    "pauseWhen": "Facebook's New post composer is open",
    "maxSteps": 8
  }]
})
```

For a **group**, add `"openUrl": "<group link>"` and make the goal: `Tap
the 'Write something…' field at the top of the group so the composer
opens.`

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. The labels
show the name it posts as and the audience (Public, Friends, Only me).

**2. Show the user the text, the identity and the audience.** Wait for a yes.

**3. Post it.**

```json
resume_task({
  "task_id": "<id>",
  "text": "<text>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(Post|POST|Share|SHARE)$",
  "goal": "<AUDIENCE> Tap the What's on your mind? text field so it is focused, then type the post into it. Then tap Post at the top right once; if the button reads Next, tap Next once and then Post or Share once on the next screen. Do not tap it twice, and do not add music, people, location or a feeling.",
  "maxSteps": 12
})
```

For **only me** replace `<AUDIENCE>` with `Tap the audience selector under
your name, choose Only me, and tap Done to return to the composer.`
Otherwise remove it.

Poll until `done`. `resume_task({ task_id, abandon: true })` leaves with
nothing posted.

## What comes back

`result.phases[0].sent` lists the Post tap only when the composer closed
and the post appeared (or a group showed "Pending approval", which counts as
posted in a moderated group).

## Delete it

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.facebook.katana",
    "goal": "In the Facebook app, tap Go to profile at the top left and find the post that begins '<first words>'. Tap the three-dot menu on that post, tap Move to trash (or Delete post), so the confirmation shows. Delete only that post.",
    "allowWrites": true,
    "pauseWhen": "the confirmation to move the post that begins '<first words>' to trash or delete it is showing",
    "maxSteps": 14
  }]
})
```

Then `resume_task({ task_id, allowWrites: true, repeat: 1, countLabel: "^(Move|MOVE|Delete|DELETE)$", goal: "Confirm, once." })`.
"Move to your trash?" hides the post from everyone at once; Facebook deletes
it for good after 30 days, or sooner from the trash.

## Notes

- **The current composer** is a "New post" screen (Music, Tag/collaborate,
  Location, Feeling/activity) that ends in Next, then SHARE in capitals; the
  count label covers both spellings. It shows the posting identity at the
  top. On a page there is no Only me audience: page posts are public.
- **Measured 2026-10-06, as a page:** the first type found no focused field
  and said so (`verified: false`), the operator tapped the field and typed
  again (`verified: true`), then Next and SHARE; removed through the Delete
  it route ("Move to your trash?" → MOVE) and gone from the page's posts.
  Needs the typing backend from 2026-10-06 on. Leaving a draft: back until
  "Discard post".
- **Only me is the safe way to test**: the post reaches no one, and it can be
  deleted right after.
- The composer's extra controls (AI label, Help me write, Feeling/activity,
  Background color) are not submit buttons; the goal ignores them.
- Facebook flags rapid repeated posting as automation. Space posts out.
