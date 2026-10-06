---
name: linkedin-withdraw-invitations
description: Withdraw old LinkedIn connection requests that were never accepted, from the Sent invitations list, after you approve. Use when the pending backlog is large (LinkedIn quietly drops new invitations from accounts carrying one) or to tidy requests older than a few weeks.
kind: workflow
title: Withdraw old LinkedIn invitations, after you approve
apps: com.linkedin.android
writes: true
reviews: true
---

# Withdraw old LinkedIn invitations, after you approve

Opens the invitations you have sent, scrolls past the recent ones to the
rows older than the age you set, and stops there for you to look. On your
yes it withdraws them one by one, each through LinkedIn's confirmation
sheet, and reports the names and the pending count it ended on.

## Inputs

| | |
|---|---|
| **days** | withdraw only invitations sent at least this many days ago, e.g. `21` |
| **steps** | the step budget for the sweep, roughly 3 per withdrawal plus scrolling; default 40 |

## Run it

**1. Find the old rows and stop.**

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "launch": "com.linkedin.android",
    "goal": "Tap My Network in the bottom navigation, open Manage all invitations, then tap the Sent tab. Note the People count in the header. The list is newest first. Scroll down past the recent rows until rows sent <days> or more days ago are on screen. Do not tap Withdraw yet and do not tap any person.",
    "allowWrites": true,
    "steps": ["the Sent invitations tab is showing with its People count", "rows sent <days> or more days ago are on screen"],
    "pauseWhen": "the Sent invitations list is showing rows sent <days> or more days ago, each with a Withdraw control",
    "maxSteps": 20
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`, and show
the user the rows on screen and the People count.

**2. Withdraw, on a yes.**

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "goal": "For each row sent <days> or more days ago, tap its Withdraw control, then tap Withdraw again in the confirmation sheet. SKIP every row sent in hours, yesterday, or fewer than <days> days ago. The People count drops by one each time one succeeds. Report every name you withdrew and the final People count. Do not send any new invitation.",
  "maxSteps": <steps>
})
```

## What comes back

The final report names who was withdrawn and the People count it ended on.
Compare it with the count at the pause: the difference is what was really
withdrawn.

## Notes

- **The step budget is the bound, not `repeat`.** The operator does not
  score the Withdraw controls as sends, so a `repeat` cap never fires here;
  measured, both the row's Withdraw and the sheet's Withdraw scored about
  0.2 as writes. Size `steps` to the number you want gone.
- **The People count is the ground truth.** Read it before and after.
- LinkedIn does not let you invite the same person again for a while after
  withdrawing, so withdraw requests that are genuinely stale, not ones from
  last week.
- Withdraw before sending a new batch when the backlog is large: an account
  carrying hundreds of pending requests gets new ones dropped quietly.
