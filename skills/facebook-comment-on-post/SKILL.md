---
name: facebook-comment-on-post
description: Find a Facebook post about a topic, open its comments, optionally switch to commenting as an anonymous group member, stop for the user to approve, then post the comment and confirm it landed. Use when asked to comment on, reply to, or engage with Facebook group posts, especially when the user should see which post was chosen first.
kind: workflow
title: Comment on a Facebook post, after you approve
apps: com.facebook.katana
writes: true
reviews: true
---

# Comment on a Facebook post, after you approve

Searches Facebook as the signed-in account, picks the first post genuinely
about the topic, opens that post's comments sheet and, if asked, turns on
"comment as an anonymous member" where the group offers it. Then it stops
holding the phone. The user sees which post it chose, and as whom it will
comment, before anything is written. On approval it types the comment and
posts it, then confirms the comment is in the list rather than trusting the
tap.

## Inputs

| | |
|---|---|
| **topic** | what to search for, e.g. `EB-2 NIW` |
| **about** | what makes a post the right one, in a few words, e.g. "someone asking about approval after an RFE" |
| **comment** | the comment, typed exactly as written; nothing else is ever typed |
| **anonymous** | `true` to comment as an anonymous group member, default `false`; only groups that allow anonymous participation offer it |

If the user has not written the comment, draft it from the post the first
call found and show it to them before the second call, never before the first.

## Run it

**1. Find the post, open its comments, set the identity.** Nothing is written.

```json
run_task({
  "phases": [{
    "launch": "com.facebook.katana",
    "goal": "In the Facebook app, tap the Search button at the top right, type '<topic>', and press enter. Stay on the All tab of the results. Find the first post that is <about> and tap the Comment button in the same card as that post's text, not the post text itself and not a Reply button on someone's comment. A comments sheet opens with a field that reads 'Write a public comment…'. <ANON> Do not type, post, like, share, join or follow.",
    "typeTexts": ["<topic>"],
    "pauseWhen": "the comments sheet of the chosen post is open, with the 'Write a public comment…' field at the bottom",
    "maxSteps": 18
  }]
})
```

For **anonymous** replace `<ANON>` with: `Then tap the small profile chip
at the left of that field; a sheet opens with your name, 'Create a nickname'
and a switch labelled 'Comment on this post as an anonymous member'. Turn
that switch on and tap Close to return to the comments sheet.` Otherwise
remove `<ANON>`.

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is
`paused`. The pause carries `context.labels`, which include the post's text
and the comments already there, so you can show the user what it chose.

**2. Show the user the post, the identity, and the comment.** Wait for a yes.

**3. Post it.**

```json
resume_task({
  "task_id": "<id>",
  "text": "<comment>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(Post|Send)$",
  "goal": "Tap the 'Write a public comment…' field, type the comment into it, then tap the blue send arrow at the right of the field to post it. Do not like, share, join or follow.",
  "maxSteps": 8
})
```

Poll until `done`. To walk away instead, call
`resume_task({ task_id, abandon: true })`: the sheet is closed, the phone
released, and nothing is posted.

## What comes back

`result.phases[0].sent` lists the comment only when its effect was verified on screen:
the field emptied and the comment appeared in the list, under your name or as
"Anonymous participant". Report that, not the tap. An unanswered pause
expires after ten minutes and the phone is released.

## Notes

- **Anonymous is a group setting.** The switch exists only where admins have
  turned on anonymous participation; elsewhere the identity sheet shows only
  your name and "Create a nickname". The run then comments as you; the pause
  is where you notice.
- **A duplicate cannot be seen when anonymous.** Your earlier anonymous
  comments look like everyone else's, so the "already commented" check by
  name does not work. Keep your own record of posts commented on.
- A comment's own **Reply** button opens a reply to that comment, not to the
  post; the goal names the post's Comment button for that reason.
- The comments sheet sorts by **Most relevant** by default; that does not
  affect posting.
- Facebook removes promotional comments and bans repeat offenders, and group
  rules often forbid links. Comments that answer the question carry; keep
  links out unless the group allows them.
