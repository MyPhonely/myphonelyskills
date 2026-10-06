---
name: linkedin-post-reactions
description: Read the people who reacted to a LinkedIn post, with each one's name, headline and connection degree. Use to turn a topic post into a list of people who have shown interest in that topic, which a job-title search cannot tell you, or to see who is engaging with a competitor's or your own posts.
kind: workflow
title: Read who reacted to a LinkedIn post
apps: com.linkedin.android
writes: false
reviews: false
---

# Read who reacted to a LinkedIn post

A post's reaction count is tappable. Tapping it opens a sheet titled **Reactions** listing every person who reacted, each with their name, connection degree and headline — the same fields a People search card gives. That turns any topic post into a list of people who have shown interest in that topic.

This is a different signal from a title search. Searching `PhD student` finds people who hold that title; reading the reactions on a post about a subject finds people who care about the subject. On one post measured on a live account, 202 people had reacted against 39 who had commented, so reactions are by far the larger pool.

Nothing is liked, commented on or reposted.

## Inputs

| | |
|---|---|
| **query** | the topic to find posts about, e.g. `EB-2 NIW` |
| **count** | how many reactors to collect, default 12 |
| **scrolls** | how far to scroll the Reactions sheet, default 6 |

## Run it

One call. Substitute the inputs.

The deep link lands directly on post results, so nothing is typed. Typing into LinkedIn's search box is the least reliable step in the app; a URL with a path opens the native app and skips it entirely.

```json
run_task({
  "phases": [{
    "launch": "com.linkedin.android",
    "openUrl": "https://www.linkedin.com/search/results/content/?keywords=<query>",
    "goal": "A LinkedIn post search results page is already open. On the FIRST post in the list, tap the reaction count, which is the small number shown next to the reaction icons underneath that post. That opens a sheet titled Reactions listing everyone who reacted. Do NOT tap the Like button, do not tap the comment count, and do not open the post itself. Once the Reactions sheet is open, read it, scrolling down at most <scrolls> times. Do not like, comment, connect, follow or send anything.",
    "steps": [
      "the Reactions sheet is open and has been read"
    ],
    "maxSteps": 20,
    "collect": {
      "record": "a person who reacted to the post",
      "fields": {
        "name": "the person's name only, without the reaction verb or badge text",
        "headline": "their headline",
        "degree": "the connection degree such as 1st, 2nd or 3rd+"
      },
      "count": <count>
    }
  }]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until the status is `done`.

## What comes back

`result.collected` holds one record per person. Feed the names straight into `linkedin-connect-with-note` or `linkedin-profile-detail`; they are the same shape a People search returns.

## Notes

- **Names arrive decorated.** A row reads `Jane Doe reacted with Like` and sometimes carries a verified badge or a degree suffix. Ask for the name without the reaction verb, as the goal above does, and strip anything left before matching the person anywhere else.
- **The sheet renders a few rows at a time**, so collection runs at roughly one person per scroll. It is slower than a People search for the same number of records; budget scrolls accordingly rather than raising `count`.
- **Give it one decision, not two.** A goal that also asks it to pick the post with the most reactions makes scrolling a competing action, and the tap on the reaction count stops clearing its threshold. Naming the first post keeps it to a single choice.
- **The pool is noisy in a specific way.** A topic post draws vendors, agencies and competitors as well as the audience, because they are monitoring the same subject. Filter on the headline before acting on anyone.
- **Comments are reachable the same way.** Tapping the comment count instead opens a sheet of commenters with the same fields. It is a much smaller pool, but a comment is a stronger signal than a reaction.
- If the run reports zero records, check `progress` for whether the reaction-count tap landed. A tap that misses usually opens the post itself, which is the wrong screen and has no Reactions sheet.
