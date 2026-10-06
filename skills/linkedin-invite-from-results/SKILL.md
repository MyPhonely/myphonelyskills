---
name: linkedin-invite-from-results
description: Send LinkedIn connection requests to several people from a People search, one tap per result card, after you approve the page. Use for outreach to a role, school or company at volume, when a note is not needed — far cheaper per invitation than opening each profile.
kind: workflow
title: Invite people from a LinkedIn search, after you approve
apps: com.linkedin.android
writes: true
reviews: true
---

# Invite people from a LinkedIn search, after you approve

Opens a People search, narrows it to 2nd-degree people, and invites up to the
number you set straight from the result cards. On a 2nd-degree card the
button reads "Invite <name> to connect": one tap sends the request, with no
note sheet, and the label turns to Pending in place, which is the check that
it worked. It stops on the filtered results first so you can see whose page
it is about to work.

For a personal note per person use `linkedin-connect-with-note` instead.

## Inputs

| | |
|---|---|
| **query** | the people search, e.g. `PhD student UCLA`, `engineering manager fintech` |
| **count** | how many to invite, at most what your weekly budget allows; default 5 |

## Run it

URL-encode the query in the link (spaces as `%20`). Two phases: narrow to
2nd degree, then invite from the cards.

```json
run_task({
  "allow_writes": true,
  "phases": [
    { "launch": "com.linkedin.android",
      "openUrl": "https://www.linkedin.com/search/results/people/?keywords=<query>",
      "goal": "In the row of filter chips near the top, tap the chip whose label is 'Filter by 2nd connections', once, so the results reload. Do nothing else: do not open All filters, do not tap any other chip, do not scroll, do not tap any card, do not tap any Invite button.",
      "require": { "label": "Filter by 2nd connections" },
      "steps": ["the 'Filter by 2nd connections' chip is selected and the results have reloaded"],
      "maxSteps": 6 },
    { "goal": "The LinkedIn People search results for '<query>' are on screen, filtered to 2nd-degree people. Invite up to <count> people from this list. To invite someone, tap the button on the right of their card whose label reads 'Invite <name> to connect'; after the tap that label changes to 'Pending'. Only cards with an 'Invite ... to connect' button can be invited: skip every card whose button reads 'Send a message', 'Pending' or 'Follow', and scroll down when no invitable card is left on screen. Do not open anyone's profile. Report the name of everyone you invited.",
      "allowWrites": true,
      "require": { "label": "^Invite .* to connect$" },
      "pauseWhen": "the 2nd-degree People search results for '<query>' are showing, with at least one 'Invite ... to connect' button",
      "repeat": <count>,
      "countLabel": "^Invite .* to connect$",
      "steps": ["up to <count> people on the list have been invited"],
      "maxSteps": <4 x count, at least 12> }
  ]
})
```

Poll `get_task_status(task_id, wait_seconds: 30)` until `paused`. The pause
carries the labels on screen: the names and buttons on the first cards. Show
the user the page and how many it will invite. On a yes:

```json
resume_task({ "task_id": "<id>", "allowWrites": true, "repeat": <count>, "countLabel": "^Invite .* to connect$" })
```

Poll until `done`. `resume_task({ task_id, abandon: true })` walks away with
nothing sent.

## What comes back

`result.phases[1].sent` lists the labels whose tap was verified, as
`Invite <name> to connect`: the card flipped to Pending. Take the name from
between "Invite" and "to connect".

## Notes

- **Confirm on the Sent tab afterwards** (`linkedin-sent-invitations`).
  LinkedIn shows Pending even while it silently drops requests past its
  weekly limit of roughly 100, on every tier including Premium. Only a name
  on the Sent list was sent.
- **`require` is the guard.** On a page with nothing invitable — the filter
  did not apply, or every card is already Pending — the phase ends after one
  look as `precondition_failed` instead of scrolling through its whole step
  budget. Measured before the guard existed: 30 steps and 62 credits for
  nothing on such a page.
- **2nd degree only.** On a Premium account a 3rd+ card offers "Send a
  message" (InMail to an open profile), not Connect; it is not a connection
  and cannot be invited from the results page.
- **The chip is a phase of its own.** Folded into the invite goal, the
  operator skipped the chips and went for the cards, then wandered for a
  hundred steps. One job per phase.
- An account carrying hundreds of pending invitations gets new ones dropped
  quietly. Withdraw old ones first (`linkedin-withdraw-invitations`).
- **The card flow does not qualify anyone.** It invites whoever the search
  found. If your audience has a rule a card cannot show (where someone did
  their first degree, say), check each person with `linkedin-profile-detail`
  first and invite them with `linkedin-connect-with-note`, or accept that
  some invitations will go to people outside it.
- **Measured on 2026-09-29** (a Premium account, through the operator): the
  chip by its full label in 3 steps and 8 credits, then 5 of 5 invited in 24
  credits, on a page that had cost 62 credits for nothing before the guard.
  On pages with nothing invitable, `require` ended each phase in 1 credit.
