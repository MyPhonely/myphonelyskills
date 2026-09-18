---
name: google-maps-place-detail
description: Read one business's details from Google Maps: address, phone number, website, hours and category. Use when asked for a business's contact details, to enrich a list of places with phone numbers and websites, or to check opening hours.
kind: workflow
title: Read a place's details on Google Maps
apps: com.google.android.apps.maps
writes: false
reviews: false
---

# Read a place's details on Google Maps

Finds one place in Google Maps and reads its page: the category, address, phone number, website, opening hours and rating line. This is the second pass the places-list workflow points to: the list gives names, this gives the contact details for the ones you chose.

Nothing is called, saved or navigated to.

## Inputs

| | |
|---|---|
| **place** | the place as you would type it into Maps, e.g. `Olympia Coffee Roasting Seattle` |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.google.android.apps.maps",
  "goal": "In Google Maps, tap the search box at the top, type '<place>', and submit. Tap the first result so the place's own page opens, then scroll down its Overview until the address, phone number, website and hours have been seen. Do not tap Call, Website, Directions, Save or Share.",
  "steps": [
    "A place page named <place> is showing",
    "The place's address and phone number are visible"
  ],
  "typeTexts": [
    "<place>"
  ],
  "maxSteps": 12,
  "collect": {
    "record": "one detail line on the place's page: its category, rating line, address, phone number, website, or opening hours",
    "fields": {
      "kind": "which detail: category, rating, address, phone, website or hours",
      "value": "the detail's text as shown"
    },
    "where": "the page of <place> with its address or phone number is showing",
    "count": 6
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per detail line found. Missing lines mean the business did not list them.

## Notes

- Hours show as today's line plus an expander. The run reads the visible line; ask for 'expand the hours' in the goal for the full week.
- Combine with the places-list workflow: run that once for the list, then this once per place you want details for.
