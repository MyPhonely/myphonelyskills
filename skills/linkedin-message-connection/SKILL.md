---
name: linkedin-message-connection
description: Send a LinkedIn message to one of your connections, typed into the conversation and stopped for you to approve before it is sent. Use for a welcome note after someone accepts, a follow-up, or answering someone who wrote to you.
kind: workflow
title: Message a LinkedIn connection, after you approve
apps: com.linkedin.android
writes: true
reviews: true
---

# Message a LinkedIn connection, after you approve

Finds the person in your Connections, opens the conversation, checks that we
have not already written, and types the message into the box without
sending it. The phone stops there with the text in place so you can read it
on the real screen; only on your yes does it tap Send, and the message
counts as sent when it shows as a bubble with the box empty.

## Inputs

| | |
|---|---|
| **person** | the connection's name, exactly as LinkedIn shows it |
| **message** | the text to send, typed exactly as written |

## Run it

**1. Type it and stop.** Nothing is sent here.

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.linkedin.android",
    "goal": "Send a LinkedIn message to <person>. Tap My Network, then Manage my network, then Connections. Find <person> and tap the Send a message control on that person's card. Before typing, read the screen: if the conversation already contains any message from us, stop immediately and type nothing. Only if it is a blank new message, tap the input that says Write a message, wait for the keyboard, and type the supplied message into it ONCE. Do NOT type it twice. Do NOT tap Send. Leave the text in the box.",
    "allowWrites": true,
    "typeTexts": ["<message>"],
    "findTexts": ["<person>"],
    "steps": ["the conversation with <person> is open", "the message text is in the Write a message input"],
    "pauseWhen": "the message to <person> is typed in the Write a message input and has not been sent",
    "maxSteps": 20
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. If it ends
`done` without pausing, read the progress: it found an earlier message from
us and typed nothing.

**2. Show the user the person and the text.** Wait for a yes.

**3. Send it.**

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^Send$",
  "goal": "The message text is already typed in the composer. Tap the Send button at the bottom right, once. Do not type anything. Do not press Enter. Do not scroll or press back. Then confirm the message appears as a bubble in the thread and the input box is empty.",
  "maxSteps": 8
})
```

Poll until `done`. `resume_task({ task_id, abandon: true })` leaves without
sending.

## What comes back

`result.phases[0].sent` lists `Send` only when the message showed as a sent
bubble with the input empty.

## Notes

- **Typing and sending are separate on purpose.** Pressing Enter in
  LinkedIn's composer inserts a new line; it does not send. And a single
  call that types and sends tended to type the text twice or stop with it
  unsent. Typing first, then a send with no text to type, is the route that
  holds.
- **It never writes twice.** The goal stops before typing when the thread
  already has a message from us, so re-running after an interruption is
  safe.
- For someone who is not a connection, the card offers Connect or InMail
  instead; this workflow is for people already connected.
- **Measured on 2026-09-29:** 3 of 3 welcome messages sent and verified by
  the bubble, two calls each, 48 credits in all.
