---
name: linkedin-search-people
description: Search LinkedIn for people and collect their names, headlines and locations from the results. Use when asked to find people on LinkedIn by role, skill, company or place, to build a prospect or candidate list, or to research who works somewhere.
kind: workflow
title: Find people on LinkedIn
apps: com.linkedin.android
writes: false
reviews: false
---

# Find people on LinkedIn

Runs a people search in the LinkedIn app as the signed-in account and reads
each result card: name, headline, location, and the current role or school
snippet. LinkedIn's terms and its defences make this one of the hardest
targets for a scraper, which is why third-party ones go stale. Here it is
simply the app, signed in as you, reading what is on the screen.

Nothing is sent. No connection requests, no messages, no profile opens.

## Inputs

| | |
|---|---|
| **query** | the search, e.g. `immigration attorney Seattle`, `PhD molecular biology` |
| **count** | how many people to collect, default 10 |
| **degree** | optional, `1st`, `2nd` or `3rd+` to filter by connection degree |

## Run it

```json
phone_task({
  "launch": "com.linkedin.android",
  "goal": "In the LinkedIn app, tap the search bar at the top, type '<query>', and submit. The results may open on the Jobs tab; tap the People tab so people results are showing. Then keep scrolling the people results. Do not tap any person's name, do not open a profile, do not tap the filter chips, and do not tap Connect, Invite or Message.",
  "steps": ["LinkedIn is open",
            "Search results for '<query>' are showing",
            "A list of people with names and headlines is showing"],
  "typeTexts": ["<query>"],
  "maxSteps": 20,
  "collect": {
    "record": "a person in the People search results",
    "fields": { "name": "the person's name",
                "headline": "their headline, the line under the name",
                "location": "their location, if shown",
                "context": "the current role, school or mutual-connections line, if shown" },
    "where": "a list of people with names and headlines is showing",
    "count": <count>
  }
})
```

With **degree**, add to the goal: "Before scrolling, tap the `<degree>` filter
chip once at the top of the results." Tap it once and leave it; the playbook
warns that toggling degree filters gets the app into a bad state.

## What comes back

`result.collected` holds one record per person, from the result cards alone.
Profile URLs and contact details are not on this screen; getting those means
opening each profile, which is a separate task per person.

## Notes

- LinkedIn settles slowly after a search, so the step budget is 20 rather
  than the usual 14. Ten people takes roughly that.
- Results open on **Jobs** on current builds. The goal above says to switch
  tabs, and the step list makes the operator confirm it before reading.
- Each card has a small Invite or Message button on the right. The goal
  forbids tapping it, and the write gate refuses it anyway without
  `allowWrites`.
- To act on the list afterwards, connect with a note per person, pass one
  name at a time to a second task with `allowWrites: true` and `repeat: 1`.
  LinkedIn caps invitations near 100 a week and silently throttles past that,
  so verify what was actually sent rather than counting taps.
