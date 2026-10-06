---
name: linkedin-inbox-replies
description: Find LinkedIn conversations where the other person wrote last and is waiting for an answer, with what they said. Use to catch replies to outreach, to see who is owed a response, or before drafting answers.
kind: workflow
title: Find LinkedIn messages waiting for your reply
apps: com.linkedin.android
writes: false
reviews: false
---

# Find LinkedIn messages waiting for your reply

Opens Messaging on the Focused tab and reads the conversation list,
keeping only the threads whose last message is from the other person. A
summary that starts with "You:" is your own last message, so those are
skipped, along with InMail and sponsored threads.

Nothing is written or sent.

## Inputs

| | |
|---|---|
| **count** | how many waiting conversations to report, default 10 |

## Run it

```json
run_task({
  "phases": [{
    "launch": "com.linkedin.android",
    "goal": "Open LinkedIn Messaging and stay on the Focused tab. Read the conversation list, scrolling down a few times. Do not open InMail or Sponsored conversations. Do not write or send anything.",
    "steps": ["The Messaging conversation list on the Focused tab is showing"],
    "maxSteps": 16,
    "collect": {
      "record": "a conversation in the LinkedIn Messaging list",
      "fields": { "name": "the other person's name",
                  "preview": "the last-message summary shown under the name, exactly as shown",
                  "time": "the time or date shown for the last message" },
      "judge": { "theirs": "the last message is from the other person: the summary does not start with 'You:', and the conversation is not marked InMail or Sponsored" },
      "require": { "theirs": 0.7 },
      "where": "the LinkedIn Messaging conversation list is showing",
      "count": <count>
    }
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `done`.

## What comes back

`result.collected` holds one record per conversation waiting on you, with
the preview LinkedIn shows: often the whole message, sometimes cut off. For
the full text, open the conversation in a second read, one person per task.

## Notes

- Answer with `linkedin-message-connection`: it stops for your approval with
  the reply in the box, and never writes into a thread twice.
- Inbound from people you never contacted shows up here too; decide whether
  outreach tooling should answer those at all.
- A preview reading "This message has been deleted." counts as theirs; skip
  it, there is nothing to answer.
- **Measured on 2026-10-06:** 5 of 5 waiting conversations in 11 steps and
  23 credits, each scored 0.94 or higher as the other person's.
- The Other tab holds messages LinkedIn judged less important. Read it as a
  second pass if replies might land there.
