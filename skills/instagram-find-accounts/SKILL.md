---
name: instagram-find-accounts
description: Search Instagram for accounts by keyword and collect their usernames and display names. Use when asked to find creators, brands or people on Instagram, build an influencer or outreach list, or see who posts about a topic there.
kind: workflow
title: Find accounts on Instagram
apps: com.instagram.android
writes: false
reviews: false
---

# Find accounts on Instagram

Searches Instagram in the app, switches to the Accounts tab, and reads each
result: username, display name, and the follower or context line the card
shows. Signed in as you, so private accounts you follow and the app's own
ranking are part of what comes back.

Nothing is followed, liked or messaged.

## Inputs

| | |
|---|---|
| **keyword** | what to search for, e.g. `seattle coffee roaster` |
| **count** | how many accounts to collect, default 15 |

## Run it

```json
phone_task({
  "launch": "com.instagram.android",
  "goal": "In the Instagram app, tap the Search tab at the bottom, tap the search bar at the top, type '<keyword>', and submit. On the results screen tap the Accounts tab so only accounts are listed, then keep scrolling the results. Do not open a profile, and do not follow, like or message anyone.",
  "steps": ["Instagram is open",
            "Search results for '<keyword>' are showing",
            "The Accounts tab is active"],
  "typeTexts": ["<keyword>"],
  "maxSteps": 14,
  "collect": {
    "record": "an account in the Accounts search results",
    "fields": { "username": "the @username",
                "name": "the display name or the line under the username",
                "context": "the followers or mutual-follow line, if shown" },
    "where": "a list of accounts with usernames is showing",
    "count": <count>
  }
})
```

## What comes back

`result.collected` holds one record per account. Bios, follower counts and
posts live on each profile, which is a separate task per account.

## Notes

- Instagram is image-first, so a post grid gives the accessibility tree very
  little to read. Accounts, hashtag pages and comment threads are text and
  read well; grids of photos do not. Collect accounts here, then open the
  handful worth a closer look.
- To read one account's posts, open the profile and switch from the grid to
  the single-post view, where captions are text.
