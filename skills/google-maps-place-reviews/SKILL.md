---
name: google-maps-place-reviews
description: Read recent reviews of one business or place on Google Maps, with rating, text and age. Use when asked what customers say about a place, to research a competitor or a vendor, to monitor your own listing's reviews, or to summarise sentiment about a business.
kind: workflow
title: Read the reviews of a place on Google Maps
apps: com.google.android.apps.maps
writes: false
reviews: false
---

# Read the reviews of a place on Google Maps

Finds one place in Google Maps, opens its Reviews tab, and reads reviews while scrolling: the star rating, the review text, the reviewer's first name and how long ago it was written. The Maps reviews actor is the second half of the store's most-run tool; this is the same data from the app, for one place at a time.

Nothing is rated, reviewed or saved.

## Inputs

| | |
|---|---|
| **place** | the place as you would type it into Maps, e.g. `Kuma Coffee Seattle` |
| **count** | how many reviews to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.google.android.apps.maps",
  "goal": "In Google Maps, tap the search box at the top, type '<place>', and submit. Tap the first result so the place's own page opens, then keep scrolling down its page past the photos and the address until reviews with star ratings are showing, and keep scrolling through them. Do not tap Write a review, do not rate, save, call or start navigation.",
  "steps": [
    "A place page named <place> is showing",
    "Reviews with star ratings and review text are showing"
  ],
  "typeTexts": [
    "<place>"
  ],
  "maxSteps": 18,
  "collect": {
    "record": "one review on the place's Reviews tab",
    "fields": {
      "rating": "the star rating of the review",
      "text": "the review text as shown",
      "reviewer": "the reviewer's name",
      "age": "how long ago it was written"
    },
    "where": "reviews of <place> with star ratings are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per review, in the app's default order, which is usually most relevant first. Ask for 'sorted by newest' in the goal to change that.

## Notes

- **Work in progress, measured 2026-09-18.** The run reaches the place page reliably, but the page opens as a sheet over a live map, and the operator has not yet learned to drag the sheet to reach the reviews below the Overview. Three runs stopped there. Expect this listing to need another pass.

- Long reviews are cut at 'More'. The visible part is what comes back.
- On current builds the place page's tabs are Overview, Photos and Updates, with no Reviews tab; reviews sit further down the Overview. The goal scrolls to them rather than looking for a tab that is not there.
