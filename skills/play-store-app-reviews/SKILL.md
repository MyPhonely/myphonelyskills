---
name: play-store-app-reviews
description: Read recent user reviews of one Android app from the Play Store, with rating, text and date. Use when asked what users think of an app, to monitor your own app's reviews, to research a competitor's app, or to gather complaints and feature requests.
kind: workflow
title: Read an app's reviews on Google Play
apps: com.android.vending
writes: false
reviews: false
---

# Read an app's reviews on Google Play

Finds an app in the Play Store, opens its listing, goes to its reviews and reads them: star rating, review text, reviewer and date. The Play Store review scrapers on the store paginate a web endpoint; this reads the same reviews from the store app.

Nothing is installed, rated or reviewed.

## Inputs

| | |
|---|---|
| **app** | the app's name as listed, e.g. `LinkedIn` |
| **count** | how many reviews to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.android.vending",
  "goal": "In the Play Store, tap the search bar at the top, type '<app>', and submit. Tap the app result named <app> so its listing opens. Scroll down to 'Ratings and reviews' and tap 'See all reviews'. Keep scrolling the reviews. Do not tap Install, Update, Open, or any rating star.",
  "steps": [
    "The listing page for the app <app> is showing",
    "A list of user reviews with star ratings and review text is showing"
  ],
  "typeTexts": [
    "<app>"
  ],
  "findTexts": [
    "See all reviews",
    "Ratings and reviews"
  ],
  "maxSteps": 18,
  "collect": {
    "record": "one user review of the app",
    "fields": {
      "rating": "the star rating of the review",
      "text": "the review text",
      "reviewer": "the reviewer's name",
      "date": "the review date"
    },
    "where": "user reviews of <app> with star ratings are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per review in the store's default order, which is most helpful first. Say 'sort by newest' in the goal to change it.

## Notes

- The store shows a handful of reviews on the listing itself; 'See all reviews' is what opens the full list, which is why it is in `findTexts`.
- No playbook for the Play Store yet; the run works from the screen alone.
