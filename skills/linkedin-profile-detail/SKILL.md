---
name: linkedin-profile-detail
description: Read a named person's LinkedIn profile: headline, about, current role, experience and education. Use when asked what someone does, to research a lead or candidate, to enrich a name into a profile, or to prepare for outreach.
kind: workflow
title: Read one LinkedIn profile
apps: com.linkedin.android
writes: false
reviews: false
---

# Read one LinkedIn profile

Opens one person's profile in the LinkedIn app and reads it top to bottom: the header, the About text, and the Experience and Education entries as far as the scroll budget allows. The most-run paid category on Apify is LinkedIn profile scraping, and it is the category scrapers get banned from; here it is your own signed-in app reading a page it is allowed to see.

Nothing is sent: no connection request, no message, no follow.

## Inputs

| | |
|---|---|
| **person** | the person's name as LinkedIn shows it, e.g. `Felicia Gittleman` |
| **context** | optional, a word or two to pick the right one in search, e.g. `immigration attorney Seattle` |

## Run it

One call. Substitute the inputs, URL-encoded in the link (spaces as `%20`).

```json
run_task({
  "phases": [{
    "launch": "com.linkedin.android",
    "openUrl": "https://www.linkedin.com/search/results/people/?keywords=<person>%20<context>",
    "goal": "The LinkedIn People search results for '<person> <context>' are open. Do not type and do not use the search box. Tap the result whose name is <person> to open their profile. On the profile, keep scrolling down through About, Experience and Education. Do not tap Connect, Follow, Message or More.",
    "steps": [
      "People search results for '<person>' are showing",
      "A profile page with the name <person> in its header is showing"
    ],
    "findTexts": [
      "<person>"
    ],
    "maxSteps": 18,
    "collect": {
      "record": "a section or entry on the profile page: the header, the About text, one Experience entry, or one Education entry",
      "fields": {
        "section": "which part: header, about, experience or education",
        "text": "the entry's text: title and company for experience, school and degree for education, the paragraph for about, name and headline for the header",
        "dates": "the date range, if the entry shows one"
      },
      "where": "a profile page whose header names <person> is showing",
      "count": 6
    }
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per section or entry, in reading order. The header comes first, then About, then experience and education entries. The profile URL is not on this screen; it is under More → Contact info, which is a separate task.

## Notes

- Profiles in creator mode show Follow instead of Connect, and some hide the About text behind a 'see more'. The run reads what is visible; a truncated About comes back truncated.
- Measured: header, About, three Experience entries and Education came back as seven records in fourteen steps before the run scrolled into 'People also viewed'. `count` is 6 so it stops while still on the profile.
- **To qualify someone by where they studied,** read only Education and let
  the read judge each entry: add `"judge": { "outside_us": "this school is
  located outside the United States", "is_education": "this entry is a school
  or university, not a job, a post or a skill" }` and `"require": {
  "is_education": 0.6 }` to `collect`, with `record` set to one Education
  entry and `count` 3. LinkedIn lists education newest first, so the last
  entry is usually the first degree; years decide when they are shown.
