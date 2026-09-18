---
name: linkedin-connect-with-note
description: Find one person on LinkedIn, open the connection request with a note, stop for the user to approve the note, then send it. Use when asked to connect with someone on LinkedIn, to reach out to a prospect or candidate, or to run outreach where each note should be personal and reviewed.
kind: workflow
title: Send a LinkedIn connection request with a note, after you approve
apps: com.linkedin.android
writes: true
reviews: true
---

# Send a LinkedIn connection request with a note, after you approve

The write no scraper can do. Finds a person in the LinkedIn app, opens their profile, taps Connect and then 'Add a note', and stops there holding the phone. You see whose profile it is and the note before anything is sent. On approval it types the note and sends, then confirms by the button turning to Pending rather than by the tap.

## Inputs

| | |
|---|---|
| **person** | the person's name as LinkedIn shows it |
| **context** | a word or two to pick the right one in search, e.g. their company |
| **note** | the connection note, under 300 characters, typed exactly as written; you can replace it at the pause |

## Run it

**1. Reach the point of no return, and stop.** Nothing is written here.

```json
phone_task({
  "launch": "com.linkedin.android",
  "goal": "In the LinkedIn app, tap the search bar at the top, type '<person> <context>', then press enter. Tap the People tab, then tap the result whose name is <person> to open their profile. On the profile tap Connect; if Connect is not shown, tap More and then Connect. When a dialog offers 'Add a note', tap it so the note field is open. Do not type and do not tap Send.",
  "typeTexts": ["<person> <context>"],
  "findTexts": ["<person>", "Connect", "Add a note"],
  "pauseWhen": "LinkedIn's connection note dialog is open for <person>: a text field for the note and a Send button are showing",
  "maxSteps": 18
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. The pause carries the labels on screen, including the profile name, so you can confirm it is the right person.

**2. Show the user the person and the note.** Wait for a yes.

**3. Send it.**

```json
resume_task({
  "task_id": "<id>",
  "text": "<note>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^send",
  "goal": "Type the note into the open note field, then tap Send to send the connection request. Do not follow or message.",
  "maxSteps": 6
})
```

Poll until `done`. To walk away, `resume_task({ task_id, abandon: true })` closes the dialog with nothing sent.

## What comes back

`result.sent` lists the request only when its effect was verified: the profile's button reading Pending. LinkedIn accepts a tap and silently drops the request once the weekly cap is hit, so the tap count is not the truth; the Sent list under My Network is.

## Notes

- LinkedIn caps invitations around 100 a week and throttles quietly past that. Keep batches small, and verify with the invitations-sent list rather than counting.
- Notes are limited to 300 characters on free accounts. A longer note is cut by the app.
- Some profiles show Follow rather than Connect. The goal covers the More menu route.
