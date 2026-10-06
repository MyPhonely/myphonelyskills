---
name: xiaohongshu-comment-on-note
description: Find a Xiaohongshu (小红书, RedNote) note by its title, open its comment input, stop for the user to approve, then post the comment and confirm the comment count went up. Use when asked to comment on or answer a Xiaohongshu note, especially in outreach where each comment should be seen first.
kind: workflow
title: Comment on a Xiaohongshu note, after you approve
apps: com.xingin.xhs
writes: true
reviews: true
---

# Comment on a Xiaohongshu note, after you approve

Searches Xiaohongshu in the app, opens the note whose title matches, opens
its comment sheet and focuses the 说点什么 input. Then it stops holding the
phone so the user can see which note it chose before anything is written.
On approval it types the comment once and taps 发布, and counts it as posted
only when the note's 评论 count goes up by one.

## Inputs

| | |
|---|---|
| **words** | distinctive words from the note's title, e.g. `工科PhD在读NIW求建议` |
| **comment** | the comment, in the note's language, typed exactly as written |

If the user has not written the comment, draft it from the note and show it
to them before the second call, never before the first.

## Run it

**1. Find the note and open its comment input.** Nothing is written.

```json
run_task({
  "phases": [{
    "launch": "com.xingin.xhs",
    "goal": "In the Xiaohongshu app, tap the Search control at the top right, tap the search field, type '<words>', and tap the Search button at the right. In the results, skip cards labelled Ads or 广告 and AskNow suggestions; tap the cover image of the note card whose title matches '<words>' so the note opens. On the note, read the comment count next to the comment bubble at the bottom (评论 N). Tap the comment bubble once to open the comment sheet, then tap the input at the bottom of the sheet (说点什么, Say something, Share your thoughts or Drop a comment) so it is focused with the keyboard up. Use only this path into the comments. Do not type the comment, do not like, collect, follow or share.",
    "typeTexts": ["<words>"],
    "findTexts": ["<words>"],
    "pauseWhen": "the comment sheet of the note about '<words>' is open, with its input (说点什么, Say something, Share your thoughts or Drop a comment) focused and the keyboard up",
    "pauseScreenshot": true,
    "maxSteps": 20
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. The comment
sheet covers the note, so its labels show only the input and emoji row; the
pause's screenshot, and the note title in the run's progress, show which note
it opened. Check it is the right one.

**2. Show the user the note and the comment.** Wait for a yes.

**3. Post it.**

```json
resume_task({
  "task_id": "<id>",
  "text": "<comment>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(发布|Post|Send)$",
  "goal": "Type the comment into the focused input once, then tap 发布 to the right of the input. Do not press Enter and do not press back. Then check the comment count went from N to N+1. If it did not, tap 发布 one more time at most, then stop. Do not like, collect or follow.",
  "maxSteps": 8
})
```

Poll until `done`. `resume_task({ task_id, abandon: true })` leaves with
nothing posted.

## What comes back

`result.phases[0].sent` lists 发布 only when the effect was verified: the
评论 count rose by one, or the input emptied and the keyboard closed. Your
own comment is hard to find in the sheet (Xiaohongshu places it
unpredictably), so the count is the check, not a search for the comment.

## Notes

- **One path into the comments.** Bouncing between the 说点什么 bar, "Drop a
  comment…" and the bubble is what loops runs. If the input does not focus
  after two tries, the run should stop: typing into nothing sends nothing,
  and a blind retype risks a duplicate.
- **Enter does not post** on Xiaohongshu, and back loses the typed text.
  Only 发布 posts.
- **With a share link** (`xhslink.com/...`, from the note's More → Copy
  link), `"openUrl"` can open the note directly. If it opens a browser
  instead of the app, use the search route; bare xiaohongshu.com links do
  not open the app.
- **Rate limits.** "操作太频繁" or "请稍后再试" means stop for the day.
  Accounts younger than about a week may not be allowed to comment.
- **Keep comments native and varied.** Identical text across notes gets an
  account throttled. Links, prices and "私信" in public comments get a
  comment folded (限流) or the account reported.
- **No `steps` on purpose.** With a step list, the run finishes as `done`
  the moment the last step is reached, before the pause fires, and there is
  no paused task left to post from. The pause condition is the finish line.
- **Measured on 2026-10-06** (read-only, writes off): search, the note, the
  comment sheet and the focused input in about 10 steps and 20 credits,
  paused, then abandoned with nothing posted. The post itself (step 3) was
  not run.
- Commenting has been the least reliable write on this app: in earlier
  outreach about one try in five landed. Expect to skip some notes.
