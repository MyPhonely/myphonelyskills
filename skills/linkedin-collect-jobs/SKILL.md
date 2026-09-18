---
name: linkedin-collect-jobs
description: Collect job postings from LinkedIn search with title, company, location and how recently they were posted. Use when asked to find jobs, track openings at companies, monitor a market for hiring, or build a list of roles matching a search.
kind: workflow
title: Collect job postings from LinkedIn
apps: com.linkedin.android
writes: false
reviews: false
---

# Collect job postings from LinkedIn

Searches jobs in the LinkedIn app and reads each result: title, company,
location, and the posted line, including whether the posting is promoted or
marked as actively hiring. Signed in as you, so the results carry the ranking
and the "you might be a fit" signals LinkedIn only shows a logged-in member.

Nothing is applied for and nothing is saved.

## Inputs

| | |
|---|---|
| **query** | the role, e.g. `staff android engineer` |
| **where** | optional location to add to the search, e.g. `Seattle` |
| **count** | how many postings to collect, default 15 |

## Run it

```json
phone_task({
  "launch": "com.linkedin.android",
  "goal": "In the LinkedIn app, tap the search bar at the top, type '<query> <where>', and submit. Make sure the Jobs tab is the active tab so job results are showing, then keep scrolling the job results. Do not open a job, do not tap Save, Apply or Easy Apply.",
  "steps": ["LinkedIn is open",
            "Search results for '<query>' are showing",
            "A list of job postings with titles and company names is showing"],
  "typeTexts": ["<query> <where>"],
  "maxSteps": 16,
  "collect": {
    "record": "a job posting in the Jobs search results",
    "fields": { "title": "the job title",
                "company": "the company name",
                "location": "the location line, including Remote or Hybrid if shown",
                "posted": "how long ago it was posted, and any Promoted or Easy Apply label" },
    "where": "a list of job postings with titles and company names is showing",
    "count": <count>
  }
})
```

## What comes back

`result.collected` holds one record per posting. The full description, the
salary band and the poster are on the job's own page, which is a separate task
per job.

## Notes

- LinkedIn search opens on Jobs by default on current builds, so this one
  needs no tab switch, unlike the people search.
- The list mixes promoted postings with organic ones. The `posted` field keeps
  the Promoted label so you can filter them out afterwards.
- To watch a market over time, run this on a schedule with the same query and
  compare titles; new postings show up at the top with a fresh posted line.
