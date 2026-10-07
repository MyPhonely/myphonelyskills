---
name: xiaohongshu-post
description: Publish a Xiaohongshu (小红书, RedNote) text note, public or visible only to you, stopping for the user to approve before it is published, and delete it again if needed. Use when asked to post or share a note on Xiaohongshu.
kind: workflow
title: Publish a Xiaohongshu note, after you approve
apps: com.xingin.xhs
writes: true
reviews: true
---

# Publish a Xiaohongshu note, after you approve

Opens Xiaohongshu's text-note editor (the red + at the bottom, then Text)
and stops with the phone held. On approval it types the note, moves to the
publish screen, sets who can see it, and taps Post once. (No title for now:
see Notes.)
A note set to Only me is not shown to anyone else, which makes it the safe
way to try the route.

## Inputs

| | |
|---|---|
| **text** | the note's text, typed exactly as written |
| **visibility** | `public` or `private` (only you can see it), default `public` |

## Run it

**1. Open the text-note editor.** Nothing is written.

```json
run_task({
  "phases": [{
    "launch": "com.xingin.xhs",
    "goal": "In the Xiaohongshu app, tap the red + button (release) in the middle of the bottom bar. In the sheet that opens, tap Text (文字), so the text-note editor opens. Do not type anything and do not tap Next or Publish.",
    "pauseWhen": "Xiaohongshu's text-note editor is open, showing Next and a 'Share your thoughts' or 'Say something or ask a question' field",
    "maxSteps": 8
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`.

**2. Show the user the text, the title and the visibility.** Wait for a yes.

**3. Publish it.**

```json
resume_task({
  "task_id": "<id>",
  "typeTexts": ["<text>"],
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(发布|发布笔记|Publish|Post|POST)$",
  "goal": "Tap the Share your thoughts field so it is focused and type '<text>'. Tap Next (下一步) until the publish screen shows. Do not type anything on the publish screen: leave the title and the text below it empty. <VISIBILITY> Then tap Post (发布) once. Do not tap it twice.",
  "maxSteps": 20
})
```

For **private** replace `<VISIBILITY>` with `Tap the Public visibility
setting, choose Private (仅自己可见), and come back to the publish screen.`
Otherwise remove it.

Poll until `done`. `resume_task({ task_id, abandon: true })` leaves with
nothing published.

## What comes back

`result.phases[0].sent` lists the Publish tap only when the publish screen
closed and the note appeared (on your profile, or with a published toast).

## Delete it

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.xingin.xhs",
    "goal": "In the Xiaohongshu app, tap Me (我) in the bottom bar. On your profile, find the note that reads '<first words>' (a private one is marked Private) and open it. Tap the three-dot menu at the top right, tap Delete (删除), so the confirmation shows. Delete only that note.",
    "allowWrites": true,
    "pauseWhen": "the confirmation to delete the note that reads '<first words>' is showing",
    "pauseScreenshot": true,
    "maxSteps": 14
  }]
})
```

Then `resume_task({ task_id, allowWrites: true, repeat: 2, countLabel: "^(删除|Delete|确定|确认|Confirm)$", goal: "Tap Delete in 'This note will be permanently deleted', then Confirm in 'Confirm to delete the note?'." })`.
Xiaohongshu asks twice; the note is gone when "Note deleted successful"
shows.

## Notes

- **No title for now.** Typing switches to MyPhonely's invisible keyboard,
  and on the publish screen Xiaohongshu answers that by moving the focus to
  the caption: text meant for the title lands in the caption, even after the
  title is tapped again (measured 2026-10-06; earlier runs showed it as a
  stray "#"). The note's text, typed in the text-note editor, is unaffected.
  A title needs typing that does not switch keyboards: the MyPhonely app
  v1.4 sets the text through accessibility instead (the result of a typing
  step then reads `"via": "accessibility"`). With 1.4 installed, try
  `"typeTexts": ["<text>", "<title>"]` and "tap the Add a title field and
  type '<title>'" in the publish goal.
- **Measured 2026-10-06:** text note typed (`verified`), Next twice,
  Public → Private, Post verified (25 credits); deleted through the Delete
  it route, two confirmations, "Note deleted successful".
- The pause condition must name what is on screen ("ready for text" never
  matched). Leaving a draft: back, then Discard, more than once.
- **A text note becomes an image.** Xiaohongshu renders the text onto a
  card; the publish screen then takes a title and an optional caption.
- **Photo notes** need the image on the phone first: `phone_push_file`, then
  Choose from album (从相册选择) instead of Text, and pick the newest image.
- Notes with links, prices or "私信" get folded (限流) or reported. New
  accounts may not be allowed to publish for their first days.
- "操作太频繁" or "请稍后再试" means stop for the day.
