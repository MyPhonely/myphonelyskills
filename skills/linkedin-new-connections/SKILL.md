---
name: linkedin-new-connections
description: Read your newest LinkedIn connections — who accepted recently, with their headline and the date shown. Use to see which invitations were accepted, before sending a welcome message, or to follow up on outreach.
kind: workflow
title: See who accepted on LinkedIn
apps: com.linkedin.android
writes: false
reviews: false
---

# See who accepted on LinkedIn

Opens My Network → Manage my network → Connections, which lists your
connections newest first, and reads the top of it: the people who accepted
most recently. Matching these names against the invitations you sent tells
you who said yes.

Nothing is changed. No messages, no profile opens.

## Inputs

| | |
|---|---|
| **count** | how many of the newest connections to read, default 8 |

## Run it

```json
run_task({
  "phases": [{
    "launch": "com.linkedin.android",
    "goal": "Read the LinkedIn Connections list. Tap My Network in the bottom navigation, then Manage my network, then Connections. The list is newest first. Read the connection cards, scrolling down a few times at most. Do not tap any profile and do not message anyone.",
    "steps": ["The Connections list is showing, newest first"],
    "maxSteps": 14,
    "collect": {
      "record": "a person in the LinkedIn Connections list",
      "fields": { "name": "the person's name only, without any badge text",
                  "headline": "their headline",
                  "connected_on": "the Connected on date shown on the card" },
      "where": "the Connections list under Manage my network is showing",
      "count": <count>
    }
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `done`.

## What comes back

`result.collected` holds one record per connection, newest first. A name
that is also on your list of sent invitations accepted; one that is not
connected some other way (they invited you, or you accepted them).

## Notes

- Names can arrive decorated (`Jane Doe Verified`, a degree token). Strip
  badge text before matching against your own records.
- Read only the top of the list. Accepted invitations land there; deeper
  rows are older connections.
- `connected_on` comes back empty on current app builds, which show no date
  on the card; order is the signal (newest first).
- **Measured:** on 2026-09-29, 3 acceptances found in one read, two from
  invitations sent the night before; on 2026-10-06, 5 of 5 in 6 steps and
  13 credits.
