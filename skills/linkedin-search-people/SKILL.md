---
name: linkedin-search-people
description: Search LinkedIn for people and collect their names, headlines and locations from the results. Use when asked to find people on LinkedIn by role, skill, company or place, to build a prospect or candidate list, or to research who works somewhere.
kind: workflow
title: Find people on LinkedIn
apps: com.linkedin.android
writes: false
reviews: false
---

# Find people on LinkedIn

Runs a people search in the LinkedIn app as the signed-in account and reads
each result card: name, headline, location, and the current role or school
snippet. LinkedIn's terms and its defences make this one of the hardest
targets for a scraper, which is why third-party ones go stale. Here it is
simply the app, signed in as you, reading what is on the screen.

Nothing is sent. No connection requests, no messages, no profile opens.

## Inputs

| | |
|---|---|
| **query** | the search, e.g. `immigration attorney Seattle`, `PhD molecular biology` |
| **count** | how many people to collect, default 10 |
| **degree** | optional, `2nd` to read only people one tap can invite |

## Run it

Open the results by link: typing into LinkedIn's search box is the least
reliable step in the app, and the link lands on the People tab directly.
URL-encode the query in the link (spaces as `%20`).

```json
run_task({
  "phases": [{
    "launch": "com.linkedin.android",
    "openUrl": "https://www.linkedin.com/search/results/people/?keywords=<query>",
    "goal": "The LinkedIn People search results for '<query>' are open. Keep scrolling the people results. Do not type, do not use the search box, do not open All filters, do not tap any person's name or open a profile, and do not tap Connect, Invite, Message or Follow.",
    "maxSteps": 16,
    "collect": {
      "record": "a person in the People search results",
      "fields": { "name": "the person's full name only, without Verified or degree text",
                  "headline": "their headline, the line under the name",
                  "location": "their location, if shown",
                  "degree": "the connection degree such as 1st, 2nd or 3rd+",
                  "action": "the label of the button on the right of the card, such as 'Invite <name> to connect', 'Send a message to <name>', 'Pending' or 'Follow'" },
      "where": "people search results for '<query>' are showing",
      "count": <count>
    }
  }]
})
```

With **degree** `2nd`, put a phase before the read that taps the chip by its
full label, and drop `launch` and `openUrl` from the read so it stays on the
filtered page:

```json
{ "launch": "com.linkedin.android",
  "openUrl": "https://www.linkedin.com/search/results/people/?keywords=<query>",
  "goal": "In the row of filter chips near the top, tap the chip whose label is 'Filter by 2nd connections', once, so the results reload. Do nothing else: do not open All filters, do not tap any other chip, do not scroll, do not tap any card.",
  "require": { "label": "Filter by 2nd connections" },
  "steps": ["the 'Filter by 2nd connections' chip is selected and the results have reloaded"],
  "maxSteps": 6 }
```

## What comes back

`result.collected` holds one record per person, from the result cards alone.
`degree` often arrives as the whole name line (`Chu Li Premium • 2nd`): read
the `• 2nd` / `• 3rd+` token from it. When `name` comes back empty, the
`action` label still carries it (`Invite <name> to connect`).
Profile URLs and contact details are not on this screen; getting those means
opening each profile, which is a separate task per person.

## Notes

- **The button on each card says what you can do**, with no judgment needed:
  `Invite <name> to connect` is a 2nd-degree person one tap can invite;
  `Send a message to <name>` on a Premium account is InMail to a 3rd+
  person, **not** an existing connection; `Pending` is already invited;
  `Follow` is creator mode. `degree` and `action` together classify a card.
- Name the chip by its full label. "2nd" alone was ambiguous on a measured
  screen; the full label is one tap.
  `require` ends the phase in one look if the chip row is not there.
- Do not open All filters: it is the most common reason a run sends or reads
  nothing.
- **Measured on 2026-10-06:** by link, 6 of 6 people in 2 steps and 6
  credits, every card's button label read; typing into the search box had
  stalled in five of six earlier attempts.
- To act on the list, see `linkedin-invite-from-results` (one tap per card)
  or `linkedin-connect-with-note` (one person, with a note). LinkedIn caps
  invitations near 100 a week and throttles quietly past that; check
  `linkedin-sent-invitations` for what really went out.
