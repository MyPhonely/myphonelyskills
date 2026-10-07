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
publish screen, fills the title, sets who can see it, and taps Publish once.
A note set to Only me is not shown to anyone else, which makes it the safe
way to try the route.

## Inputs

| | |
|---|---|
| **text** | the note's text, typed exactly as written |
| **title** | the note's title, typed exactly as written; optional |
| **visibility** | `public` or `only me`, default `public` |

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
  "typeTexts": ["<text>", "<title>"],
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(发布|发布笔记|Publish|Post)$",
  "goal": "Type the text '<text>' into the editor, then tap Next (下一步) until the publish screen with a title field shows. Tap the title field and type '<title>'. <VISIBILITY> Then tap Publish (发布 / 发布笔记) at the bottom once. Do not tap it twice.",
  "maxSteps": 18
})
```

For **only me** replace `<VISIBILITY>` with `Tap the visibility setting
(公开可见 / Public, or 谁可以看), choose 仅自己可见 / Only me, and go back to
the publish screen.` Otherwise remove it.

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
    "goal": "In the Xiaohongshu app, tap Me (我) in the bottom bar. On your profile, open the note titled '<title>' (check the Only me / private tab too). Tap the three-dot menu at the top right, tap Delete (删除), then confirm. Delete only that note.",
    "allowWrites": true,
    "pauseWhen": "the confirmation to delete the note titled '<title>' is showing",
    "maxSteps": 14
  }]
})
```

Then `resume_task({ task_id, allowWrites: true, repeat: 1, countLabel: "^(删除|Delete|确定|确认)$", goal: "Confirm the deletion, once." })`.

## Notes

- **Not reliable yet (measured 2026-10-06, nothing published):** the editor,
  the text and Next worked, and the publish screen opened, but the title came
  out as "Test note#a" (a stray "#" opened topic suggestions), the
  visibility stayed Public, and the run stopped before Publish. The pause
  condition must name what is on screen ("ready for text" never matched).
  Leaving discards the draft: back, then Discard, more than once.
- **A text note becomes an image.** Xiaohongshu renders the text onto a
  card; the publish screen then takes a title and an optional caption.
- **Photo notes** need the image on the phone first: `phone_push_file`, then
  Choose from album (从相册选择) instead of Text, and pick the newest image.
- Notes with links, prices or "私信" get folded (限流) or reported. New
  accounts may not be allowed to publish for their first days.
- "操作太频繁" or "请稍后再试" means stop for the day.
