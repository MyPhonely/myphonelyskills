---
name: google-maps-collect-places
description: Collect businesses from Google Maps by category and area, with rating, review count and address. Use when asked to build a list of local businesses, find leads in a city, research competitors nearby, or gather places of a certain kind in a certain place.
kind: workflow
title: Collect local businesses from Google Maps
apps: com.google.android.apps.maps
writes: false
reviews: false
---

# Collect local businesses from Google Maps

Searches Maps for a kind of business in an area and reads the results list as
it scrolls: name, rating, how many reviews, category, and the address line.
The classic lead-generation list, built on a real phone rather than through a
scraping API, so no proxy pool, no blocks, and the results are the ones a
person in that area would actually see.

## Inputs

| | |
|---|---|
| **what** | the kind of place, e.g. `dentist`, `coffee roaster`, `plumber` |
| **where** | the area, e.g. `Bellevue WA`, `Shoreditch London` |
| **count** | how many places to collect, default 20 |

## Run it

```json
phone_task({
  "launch": "com.google.android.apps.maps",
  "goal": "In Google Maps, tap the search box at the top, type '<what> in <where>', and submit the search. Wait for the list of results to appear, then keep scrolling down the list. Do not open any individual place, do not start navigation, and do not save or rate anything.",
  "steps": ["Google Maps is open",
            "Results for '<what> in <where>' are listed"],
  "typeTexts": ["<what> in <where>"],
  "maxSteps": 14,
  "collect": {
    "record": "a business in the Maps results list",
    "fields": { "name": "the business name",
                "rating": "the star rating",
                "reviews": "the rating line as shown, which carries the number of ratings",
                "category": "the business category" },
    "where": "a list of places with names and star ratings is showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `done`.

## What comes back

`result.collected` holds one record per business: name, rating, the rating
line with its count, and the category. Fields the card did not show come back
empty rather than invented, so a place with no rating yet has an empty one.

Addresses and phone numbers are not on the results list, only on each place's
own page. That is a second task per place, so ask for it for the handful you
actually want, not the whole list.

## Notes

- Maps sometimes lands on the map with results in a sheet at the bottom. If
  the run reports few records, add "drag the results sheet up so the list
  fills the screen" to the goal.
- There is no app playbook for Maps yet, so the operator works from the live
  screen alone here. It is the one workflow in this catalog without that
  backing.
