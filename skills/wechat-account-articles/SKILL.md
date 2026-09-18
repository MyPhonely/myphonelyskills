---
name: wechat-account-articles
description: List the recent articles published by one WeChat official account, with titles and dates. Use when asked what a Chinese company, media outlet or organisation has published on WeChat, to monitor an official account, or to gather article titles for research.
kind: workflow
title: Read a WeChat official account's recent articles
apps: com.tencent.mm
writes: false
reviews: false
---

# Read a WeChat official account's recent articles

Opens a WeChat official account you follow and reads its article history: each article's title and publication date. Official accounts are the publishing layer of the Chinese internet and have no web presence a scraper can reach; the phone reads them from the app you are signed into.

Nothing is sent, followed, or shared.

## Inputs

| | |
|---|---|
| **account** | the official account's name as it appears in your subscriptions, e.g. `移民局` |
| **count** | how many articles to collect, default 10 |

## Run it

One call. Substitute the inputs.

```json
phone_task({
  "launch": "com.tencent.mm",
  "goal": "In WeChat, tap the search icon at the top, type '<account>', and open the official account named <account> from the results, the one marked as an Official Account or 公众号. On the account's page, open its message history or article list, then keep scrolling the articles. Do not follow, unfollow, send a message or open an article.",
  "steps": [
    "The official account <account> is open",
    "A list of articles from <account> with titles is showing"
  ],
  "typeTexts": [
    "<account>"
  ],
  "findTexts": [
    "<account>"
  ],
  "maxSteps": 18,
  "collect": {
    "record": "one article in the account's history",
    "fields": {
      "title": "the article title",
      "date": "the publication date or time, if shown",
      "summary": "the summary line under the title, if shown"
    },
    "where": "articles published by <account> with titles are showing",
    "count": <count>
  }
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per article, newest first. Article bodies open in WeChat's built-in browser, which the phone tools do not read; this workflow stops at the list.

## Notes

- You must already follow the account, or the search result must be public. Following is a write the gate refuses.
- WeChat has no app playbook on the server yet, and its accessibility tree is sparser than most apps'. Expect this one to need tuning after its first runs.
