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

**3. Type the title and the body, each exactly once.** Type them in two
calls, one field each. Reddit's body editor can report a type as unverified
after the text has already landed, and a retry inside one call appends the
whole text again (measured 2026-10-12, r/immigraus). One field per call
keeps a retry from repeating the other.

```json
resume_task({
  "task_id": "<id>",
  "text": "<title>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^Post$",
  "goal": "Tap the Title field and type the title exactly once. Do not tap Post.",
  "maxSteps": 6
})
```

Then the body, once, and post:

```json
resume_task({
  "task_id": "<id>",
  "text": "<body>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^Post$",
  "goal": "Tap the body text field and type the body exactly once. The body editor's typing can read unverified even after the text has landed, so never type it twice: if the field already shows the body, leave it; if the body shows twice, clear the field and type it once. Then check Post is enabled and no flair or rules prompt is showing, and tap Post at the top right once. Do not tap Post twice. If 'Get updates on your posts' appears afterwards, tap Skip; if a sheet offers to repost into other communities, tap Close sheet.",
  "maxSteps": 10
})
```

Poll until `done`. `resume_task({ task_id, abandon: true })` leaves the
editor with nothing posted.

**4. Check the post is not doubled.** Open the new post (the community's
New feed, by link, then tap it) and read the body. If the title or the body
appears twice, the run typed it twice: delete the post (see Delete it) and
post it again from step 1. A duplicate is worse than none.

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
- **One field per `resume_task`, via `text`.** Putting the title and the
  body in one call (`typeTexts: ["<title>", "<body>"]`) let the operator
  type the body, read its verification as unverified, and type it again,
  appending a second copy (2026-10-12, r/immigraus). Pass a single `text`
  per call so there is nothing to pick between, and never retype a field
  that already shows the text.
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
