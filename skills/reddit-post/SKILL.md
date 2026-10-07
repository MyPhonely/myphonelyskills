---
name: reddit-post
description: Publish a new post to a subreddit or to your own Reddit profile, stopping for the user to approve before it is posted, and delete it again if needed. Use when asked to post, share or start a discussion on Reddit.
kind: workflow
title: Publish a Reddit post, after you approve
apps: com.reddit.frontpage
writes: true
reviews: true
---

# Publish a Reddit post, after you approve

Opens Reddit's post editor, chooses the community first (Reddit keeps Post
disabled until one is chosen), and stops with the phone held so you can see
where it will go. On approval it types the title and the body, taps Post
once, and counts it as published when the new post's own page opens.

## Inputs

| | |
|---|---|
| **community** | the subreddit without `r/`, e.g. `EB2_NIW`, or `profile` for your own profile |
| **title** | the post title, typed exactly as written |
| **body** | the post text, typed exactly as written; optional |

## Run it

**1. Open the editor and choose the community.** Nothing is written.

```json
run_task({
  "phases": [{
    "launch": "com.reddit.frontpage",
    "goal": "In the Reddit app, tap Create in the bottom bar so the post editor opens. Tap 'Select a community'. <WHERE> Do not type a title or body and do not tap Post.",
    "typeTexts": ["<community>"],
    "pauseWhen": "Reddit's post editor is open with <community or your profile> chosen as the community, and empty Title and body fields",
    "maxSteps": 12
  }]
})
```

For a subreddit replace `<WHERE>` with `Type '<community>' in the community
search and tap r/<community> in the list.` For your profile replace it with
`Choose your own profile (u/<your username>, 'Your profile') at the top of
the list.` and drop `typeTexts`.

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`; the labels
show the chosen community.

**2. Show the user the title, the body and the community.** Wait for a yes.

**3. Post it.**

```json
resume_task({
  "task_id": "<id>",
  "typeTexts": ["<title>", "<body>"],
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^Post$",
  "goal": "Tap the Title field and type '<title>'. Then tap the body text field and type '<body>'. Check Post is enabled and no flair or rules prompt is showing, then tap Post at the top right once. Do not tap Post twice. If 'Get updates on your posts' appears afterwards, tap Skip; if a sheet offers to repost into other communities, tap Close sheet.",
  "maxSteps": 10
})
```

Poll until `done`. `resume_task({ task_id, abandon: true })` leaves the
editor with nothing posted.

## What comes back

`result.phases[0].sent` lists `Post` only when the editor closed and the new
post's page (or the community feed with it) appeared. Reddit follows a
publish with two prompts ("Get updates on your posts", then a sheet offering
to repost elsewhere); if the run ends stuck on one of them, the post went up:
check the community's New feed.

## Delete it

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.reddit.frontpage",
    "goal": "In the Reddit app, open r/<community> through the search bar (never the Ask button) and set the sort to New. Wait for the feed to stop moving, then open the post titled '<title>' by u/<your username>; if the post page that opens is someone else's, press back and tap it again. Tap the post's Post menu at the top right, then Delete, so 'Are you sure?' shows. Delete only that post.",
    "allowWrites": true,
    "findTexts": ["<title>"],
    "pauseWhen": "Reddit's 'Are you sure?' confirmation to delete the post titled '<title>' is showing",
    "maxSteps": 14
  }]
})
```

Then `resume_task({ task_id, allowWrites: true, repeat: 1, countLabel: "^Delete$", goal: "Tap Delete to confirm, once." })`.

## Notes

- **Choose the community first.** The editor's Post button stays disabled
  until a community is chosen; some subreddits then demand flair or a
  minimum karma ("you are not allowed to post here"), which the run reports
  instead of retrying.
- **Test in r/test.** It exists for test posts. The community picker on the
  current build offers no "your profile" option (measured 2026-10-06).
- **Quote the body in the goal.** With only "type the body", the operator
  could not pick which supplied text to type and stalled after the title.
- **Find your new post in the community's New feed,** not your profile: the
  profile's Posts tab did not list it minutes later. A feed tap can open the
  neighbouring post (the feed shifts as it loads, and the post viewer keeps
  neighbours loaded just off screen), so check the post page's own header
  reads your username before deleting.
- **Measured 2026-10-06:** posted to r/test (title and body), confirmed at
  the top of New; deleted ("Are you sure?" → Delete) and gone from the
  refreshed feed.
- Most subreddits remove promotional posts and links; read the rules before
  posting to one.
