---
name: reddit-comment-on-post
description: Find a post in a subreddit, open its real comment composer, stop for the user to approve, then post the comment and confirm the comment count went up. Use when asked to comment on or answer a Reddit post, especially in outreach where each comment should be seen first.
kind: workflow
title: Comment on a Reddit post, after you approve
apps: com.reddit.frontpage
writes: true
reviews: true
---

# Comment on a Reddit post, after you approve

Opens the subreddit, finds the post by its title, opens it, and taps the
post's own action row so the real comment composer comes up. Then it stops
holding the phone, so the user can see which post it chose before anything
is written. On approval it types the comment once, taps Post once, and
counts the comment as posted only when the post's comment count rises (or
Reddit says it is pending review).

It reaches the post through the subreddit, never through search: Reddit's
search bar has an Ask button that opens Reddit Answers, an AI box with its
own text field and Send button. A comment typed there is a question to the
AI, not a comment, and it is the most common way Reddit comments fail.

## Inputs

| | |
|---|---|
| **subreddit** | the community, without `r/`, e.g. `EB2_NIW` |
| **post** | distinctive words from the post's title, to find it |
| **comment** | the comment, typed exactly as written; nothing else is ever typed |

If the user has not written the comment, draft it from the post and show it
to them before the second call, never before the first.

## Run it

**1. Find the post and open its composer.** Nothing is written.

```json
run_task({
  "phases": [{
    "launch": "com.reddit.frontpage",
    "goal": "In the Reddit app, tap the search bar at the top labelled 'Find anything' (never the Ask button), type '<subreddit>', and tap the community result r/<subreddit> so the subreddit opens. If a sort label is visible, set it to New, trying at most twice; otherwise read the feed as it is. Wait for the feed to stop moving, then tap the post card whose title contains '<post>'. The feed can shift while it loads, so check the post page that opens: if its title does not contain '<post>', press back once and tap that card again. On the right post page, read the comment count in the action row that reads 'N votes, N comments, N shares', then tap that action row so the comment composer opens with the keyboard up. If the screen shows 'Reddit Answers', 'Ask a question' or 'Submit question', press back: that is not the composer. Do not type the comment, do not upvote, share, join or follow.",
    "typeTexts": ["<subreddit>"],
    "findTexts": ["<post>"],
    "pauseWhen": "the real comment composer for the post titled '<post>' is open: a focused text field with the keyboard up, and no 'Reddit Answers', 'Ask a question' or 'Submit question' on screen",
    "pauseScreenshot": true,
    "maxSteps": 20
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. Check the
pause's screenshot and labels: the post title must be the right one, and no
Reddit Answers text may be among them. If it is not the right post, abandon.

**2. Show the user the post and the comment.** Wait for a yes.

**3. Post it.**

```json
resume_task({
  "task_id": "<id>",
  "text": "<comment>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^Post$",
  "goal": "Type the comment into the focused composer once, then tap Post at the top right once. Do not tap Post twice. Then confirm the post's comment count went up by one, or the comment shows in the thread, or Reddit says it will be reviewed. Do not upvote, share, join or follow.",
  "maxSteps": 8
})
```

Poll until `done`. `resume_task({ task_id, abandon: true })` closes the
composer with nothing posted.

## What comes back

`result.phases[0].sent` lists `Post` only when the effect was verified: the
comment count rose, the comment is in the thread, or "Comment will be
reviewed" appeared (pending moderation, which counts as posted). "Join the
conversation" appearing afterwards is normal: the composer closed.

## Notes

- **Prefer the post's link.** When you collect posts, copy each one's link
  (the post's ⋯ menu → Copy link, then `phone_clipboard`), and open the post
  for commenting with `"openUrl": "<the link>"` instead of the subreddit
  route: a share link (`reddit.com/r/<sub>/s/...`) opened the right post in
  the app (2026-10-06), with no feed taps that can land on a neighbour.
  Start the goal at the post page ("On the post page, tap the action row…").
  If Chrome opens instead of the app, use the subreddit route. Never use reddit.com links for search or a
  subreddit's feed: the web version needs a login and goes nowhere.
- **Already commented?** The goal can be told to look for your username in
  the visible comments before opening the composer, and stop if it is there.
  A duplicate is worse than none.
- **Rate limits.** "You're doing that too much" means stop for the day. New
  or low-karma accounts may get "you are not allowed to post here", and some
  subreddits require flair first.
- **Vary every comment.** Identical text across posts gets an account
  shadowbanned. Most subreddits remove promotional comments and links;
  answer the question.
- **Sort is fragile.** The New sort and the time filter mis-tap often; the
  goal tries New twice at most and then reads post ages inline.
- If the action row is missing from the screen after one retry, the run
  stops before writing rather than tapping guessed coordinates.
- **No `steps` on purpose:** with them the run ends `done` when the last
  step is reached, before the pause, leaving nothing to post from.
- **Not yet reliable.** Measured on 2026-10-06, writes off, five runs and
  none reached the composer: a tap on a feed card opened the post above it
  (the feed shifts while it loads, so check the title on the post page);
  the subreddit route sometimes landed on another feed and scrolled it;
  searching a post's title returned months-old look-alikes, not the new
  post; Enter did not submit Reddit's search. The link route above is the
  sturdy one; it needs the backend whose `phone_clipboard` reads through the
  app's ClipboardActivity (2026-10-06), since the older read came back
  empty. Every failure stopped before anything was written.
