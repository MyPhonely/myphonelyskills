# Find a post, review, reply

Find the newest post about a topic on X, open its reply composer, stop for
the user to approve the comment, then post it. Three tool calls; the phone
is held between them.

## 1. Find and open the composer, then pause

```
phone_task({
  launch: "com.twitter.android",
  goal: "In the X app, search for 'EB-2 NIW', submit, switch to the Latest tab. Then, on the first post in the results that is genuinely about the EB-2 NIW visa, tap the Reply button that belongs to that post — the 'Reply' in the same card as its text, not the post text itself — so the reply composer opens for it. Do not type, post, like, repost or follow.",
  typeTexts: ["EB-2 NIW"],
  pauseWhen: "X's reply composer is open: a 'Replying to @…' line and a 'Post your reply' field are showing, with the keyboard up",
  maxSteps: 16
})
```

Follow it with `get_task_status(task_id, { wait_seconds: 30 })` until
`status` is `paused`. The pause carries `context.labels`, which include the
"Replying to @…" line, so you can tell the user whose post it is.

## 2. Show the user, get the comment

Draft the comment from what the pause shows, or take the user's text. Do
not post anything they have not seen.

## 3. Resume with the text, allowing the one write

```
resume_task(task_id, {
  text: "Great summary — NIW timelines have really shifted this year.",
  allowWrites: true,
  repeat: 1,
  countLabel: "^(reply|post)$",
  goal: "Type the comment into the focused reply field, then tap the Reply button to post it. Do not like, repost or follow.",
  maxSteps: 8
})
```

Poll again until `done`. `result.sent` lists the write only if its effect
was verified on screen (the composer closed and the thread returned).
Report that, not the tap.

To walk away instead: `resume_task(task_id, { abandon: true })`. The
composer is closed and the phone released; nothing is posted.
