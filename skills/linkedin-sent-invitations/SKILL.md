---
name: linkedin-sent-invitations
description: Read the connection requests you have sent on LinkedIn that are still pending, with each person's name, headline and how long ago it went out. Use when asked who has not accepted yet, how many invitations are outstanding before sending more, which requests are stale enough to withdraw, or whether requests you think you sent really went out.
kind: workflow
title: See the LinkedIn connection requests you have sent
apps: com.linkedin.android
writes: false
reviews: false
---

# See the LinkedIn connection requests you have sent

Opens My Network in the LinkedIn app, goes to the invitations you have sent,
and reads the pending ones: who, their headline, and how long ago each went
out. This list is the only ground truth for outreach on LinkedIn. A tap on
Connect is not a request, and a profile reading Pending is not proof either,
because LinkedIn shows Pending even while it silently drops invitations past
its weekly limit. What is on this screen was actually sent.

Nothing is changed. No withdrawals, no profile opens, no messages.

## Inputs

| | |
|---|---|
| **count** | how many pending invitations to read, newest first, default 20 |

## Run it

```json
phone_task({
  "launch": "com.linkedin.android",
  "goal": "In the LinkedIn app, tap My Network in the bottom bar. On the Invitations row tap 'Manage all invitations'. Tap the Sent tab. Then keep scrolling the list of sent invitations. Do not tap Withdraw, do not tap any name or open a profile, and do not tap Connect or Message.",
  "steps": ["LinkedIn is open",
            "An invitations screen with Received and Sent tabs is showing",
            "A list of sent invitations, each with a 'Sent ... ago' label and a Withdraw button, is showing"],
  "maxSteps": 18,
  "collect": {
    "record": "a pending invitation in the list of sent invitations",
    "fields": { "name": "the person's name",
                "headline": "their headline, the line under the name",
                "sent": "how long ago it was sent, exactly as labelled, e.g. 'Sent 3 weeks ago'" },
    "where": "a list of sent invitations, each with a 'Sent ... ago' label and a Withdraw button, is showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `done`.

## What comes back

`result.collected` holds one record per pending invitation, newest first. The
`sent` field is LinkedIn's relative label, not a date: `Sent 13 hours ago`,
`Sent yesterday`, `Sent 5 days ago`, `Sent 3 weeks ago`. Convert it to days
yourself when you need to compare against a threshold.

The top of the Sent tab carries the total still pending, as `People (N)`. It
is the number to check before sending more.

## Notes

- **Before sending more requests, run this.** LinkedIn caps invitations around
  100 a week and throttles quietly past that. Counting the rows labelled in
  hours or days up to a week tells you where you stand; a count kept anywhere
  else will drift, because every other tool that sends from the same account
  is invisible to it.
- **To confirm a send,** look for the name here after the connect task
  finishes. If it is missing, the request was dropped whatever the profile
  said.
- **Withdrawing is a separate write,** one name per task with `allowWrites`
  and a `pauseWhen` on the confirmation dialog. This workflow never taps
  Withdraw, and the write gate refuses it anyway.
- Received invitations sit on the other tab of the same screen. Suggested
  people with Connect buttons also appear under My Network; they are not
  sent invitations, and the step list keeps the read on the Sent tab.
- The list loads lazily as you scroll. Past a few hundred pending the app
  slows, which is also a sign the backlog wants withdrawing.
- **Measured, 2026-09-23.** Ten of ten records in nine steps and 16 credits,
  all three fields filled, nothing written. The route is My Network, then
  'Manage all invitations', then Sent, each tapped at 0.97 or better. The
  `where` gate is what keeps the read honest: it scored 0.02 on the home feed
  and 0.02 on My Network, whose suggested-people cards look like a list of
  people with buttons, and only opened once the Sent list was showing.
