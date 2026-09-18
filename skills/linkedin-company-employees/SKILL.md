---
name: linkedin-company-employees
description: List people who work at a company from its LinkedIn page, with names, roles and locations. Use when asked who works at a company, to find the right contact there, to size a team, or to build an account-based prospect list.
kind: workflow
title: List a company's employees on LinkedIn
apps: com.linkedin.android
writes: false
reviews: false
---

# List a company's employees on LinkedIn

Opens a company's page in the LinkedIn app, goes to its People section, and reads each person card: name, role headline, and location. Optionally filtered by a title keyword. The scraper version of this needs cookies or a cracked API; the phone version is the page your account can already see.

No one is connected with or messaged.

## Inputs

| | |
|---|---|
| **company** | the company name as LinkedIn shows it, e.g. `Cowan Miller & Lederman` |
| **role** | optional keyword to filter people by, e.g. `attorney` |
| **count** | how many people to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.linkedin.android",
  "goal": "In the LinkedIn app, tap the search bar at the top, type '<company>', then press enter. Tap the Companies tab and tap the company result named <company> to open its page. On the company page tap the People tab. If a search field for people appears and a role was given, type '<role>' into it. Then keep scrolling the people list. Do not tap Follow, Connect or Message.",
  "steps": [
    "A company page named <company> is showing",
    "A list of people who work at <company> is showing"
  ],
  "typeTexts": [
    "<company>",
    "<role>"
  ],
  "findTexts": [
    "People"
  ],
  "maxSteps": 22,
  "collect": {
    "record": "a person listed under the company's People section",
    "fields": {
      "name": "the person's name",
      "headline": "their role or headline line",
      "location": "their location, if shown"
    },
    "where": "a list of people at <company> with names and roles is showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per person. LinkedIn shows a sample of employees on the People tab and hides the rest behind its own paywall for larger companies; the run reads what the app shows.

## Notes

- Companies with common names return several results. Give the exact name as the page shows it, and the run matches on it.
- Leave `role` empty to get the page's default ordering, which is usually people closest to your network.
