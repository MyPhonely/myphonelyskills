---
name: facebook-search-posts
description: Search Facebook for posts about a topic across the groups you can see, and collect the ones written by people asking a question or sharing their situation, with group, text and age. Use when asked to find Facebook posts about a subject, monitor what people are asking in groups on a topic, or shortlist posts worth replying to.
kind: workflow
title: Search Facebook posts about a topic
apps: com.facebook.katana
writes: false
reviews: false
---

# Search Facebook posts about a topic

Types a topic into Facebook search and reads the post cards in the results
while scrolling: which group each post is in, who wrote it if shown, the
text, and how long ago. Signed in as you, so it reaches posts in groups you
belong to as well as public ones, which no logged-out scraper sees.

Nothing is opened, joined, liked, commented or shared.

## Inputs

| | |
|---|---|
| **topic** | what to search for, e.g. `EB-2 NIW` |
| **count** | how many posts to collect, default 10 |
| **claim** | what makes a post worth keeping; default "the post is written by a person asking a question or sharing their own situation, not a business, consultancy or law firm promoting a service" |

## Run it

```json
run_task({
  "phases": [{
    "launch": "com.facebook.katana",
    "goal": "In the Facebook app, tap the Search button at the top right, type '<topic>', and press enter. On the results screen stay on the All tab: do not tap Meta AI, People, Groups, Events, Pages, Reels or Marketplace. If a line reads 'Search instead for <topic>', tap it. Then keep scrolling the results. Do not tap Join on any group, do not open a post, and do not like, comment or share.",
    "steps": ["Facebook is open",
              "Search results for '<topic>' are showing, with post cards in the list"],
    "typeTexts": ["<topic>"],
    "maxSteps": 20,
    "collect": {
      "record": "a post in the search results written by a person in a group: a card with a group name, a post text and an age, not a group card with a Join button, not a page, not an ad",
      "fields": { "group": "the group name shown at the top of the card",
                  "text": "the post text, as far as the card shows it",
                  "age": "how long ago it was posted",
                  "comments": "the comment count, if shown" },
      "judge": { "wanted": "<claim>" },
      "require": { "wanted": 0.7 },
      "where": "search results for '<topic>' with post cards are showing",
      "count": <count>
    }
  }]
})
```

## What comes back

`result.collected` holds one record per post that passed the claim, each
with `p_wanted`. Comment on one with **facebook-comment-on-post**, naming the
same topic and a phrase from the post's text as `about`.

## Notes

- **There is no Posts tab** on the current build. The tabs are Meta AI, All,
  People, Groups, Events, Pages, Reels and Marketplace; posts appear in **All**,
  below a Meta AI summary and a row of group cards. The record description
  above is what separates the post cards from those.
- Facebook may quietly correct the query ("Including results for eb-2 now").
  The goal taps "Search instead for …" when it appears; check `text` for the
  topic anyway.
- Consultancies and law firms post on these topics constantly. The default
  claim drops them; tune it to your subject.
- The **Join** buttons on group cards are writes; the goal forbids them, and
  the gate refuses them without `allowWrites`.
- Tapping a post's text expands it in place rather than opening it, so long
  posts show more after a tap; this workflow does not tap, so `text` is the
  visible part.
