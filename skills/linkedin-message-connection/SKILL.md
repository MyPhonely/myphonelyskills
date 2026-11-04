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

Finds the person in your Connections, opens the conversation, and types the
message into the box without sending it. A newly accepted connection often
shows the invitation note we attached to the request: that note is not a
reply and not a reason to stop. The composer is either the thread's Write a
message field or a New message sheet; both are the right screen. The phone
stops with the text in place so you can read it; only on your yes does it
tap Send once, and the message counts as sent when it shows as a bubble
with the box empty. If that does not happen, the draft is cleared and
nothing is left in the composer.

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
    "goal": "Open the LinkedIn message composer for <person> and type the supplied message once. Tap My Network, then Manage my network, then Connections. Find <person> and tap Message or Send a message on that card. The screen is right if it is the conversation (a Write a message field; Name this chat is only a label, leave it alone) or a New message sheet that already names them and shows Send. Do not leave a composer that is already open, and do not start a second one. Read the thread before typing. The invitation note on the connection request is not a reply and not a past message from us: a connection-request banner, or the note text we attached when we invited them, does not count. Type nothing only when a chat bubble from us, sent after they accepted, is already in the thread. Otherwise focus Write a message, or the field on the New message sheet, and type the supplied message once. Do not type it twice. Do not tap Send. Do not press Enter, which inserts a line. Leave the text in the field.",
    "allowWrites": true,
    "typeTexts": ["<message>"],
    "findTexts": ["<person>"],
    "pauseWhen": "the composer for <person> shows the full supplied message and a Send button, and the message has not been sent, on either the thread's Write a message field or the New message sheet",
    "maxSteps": 22
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. If it ends
`done` without pausing, read the progress: it found a chat bubble we sent
after they accepted, and typed nothing. An invitation note is not that.

**2. Show the user the person and the text.** Wait for a yes.

**3. Send it.**

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^Send$",
  "goal": "The message to <person> is already in the composer. Read it and confirm it is the supplied message. Tap Send once. Do not type, do not press Enter, do not scroll, do not press back, and do not tap Name this chat. Then confirm that text appears as a sent bubble and the input is empty. If no sent bubble appears, stop without tapping Send again.",
  "maxSteps": 8
})
```

Poll until `done`. `sent` lists `Send` only when the bubble is there and the
field is empty. If it does not, clear the draft before leaving: `phone_clear_text`
on the focused field, or one task whose goal is "An unsent draft for <person>
is in the LinkedIn composer (the thread field or a New message sheet). Delete
every character so the field is empty. Do not tap Send and do not press Enter.
On a New message sheet, clear the field and close the sheet without sending.
Stop when no draft text remains." Then look. `resume_task({ task_id, abandon: true })`
leaves a paused task without sending; clear the field first if text is in it.

## What comes back

`result.phases[0].sent` lists `Send` only when the message showed as a sent
bubble with the input empty.

## Notes

- **Typing and sending are separate on purpose.** Pressing Enter in
  LinkedIn's composer inserts a new line; it does not send. And a single
  call that types and sends tended to type the text twice or stop with it
  unsent. Typing first, then a send with no text to type, is the route that
  holds.
- **No `steps` in the first call, on purpose:** a last step that matches the
  pause condition lets the run finish as `done` before it pauses, and then
  there is nothing to resume.
- **The invitation note is not a message.** Stopping because "we already
  wrote" was the note on the connection request, so a new connection never
  got a warmup. Only a chat bubble sent after they accepted counts.
- **Name this chat and the New message sheet are the same composer.** Do
  not wander between them, and do not pause on a screen that has no Send
  button. The pause is the text in the field with Send showing.
- **One Send, then look.** A second tap does not fix a send that did not
  land. Clear the draft instead of leaving it in the field.
- **It never writes twice.** The goal stops before typing when a real
  bubble from us is already there, so re-running after an interruption is
  safe.
- For someone who is not a connection, the card offers Connect or InMail
  instead; this workflow is for people already connected.
- **Measured on 2026-09-29:** 3 of 3 welcome messages sent and verified by
  the bubble, two calls each, 48 credits in all.
