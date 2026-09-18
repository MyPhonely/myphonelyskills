# Collect posts about a topic

Read N posts about a topic from an app's search results, with authors,
keeping only the ones a claim holds for. One call: the operator navigates
and reads while it scrolls.

```
phone_task({
  launch: "com.twitter.android",
  goal: "In the X app, search for 'NIW', submit the search, then switch to the Latest tab so the newest posts about NIW are showing. Do not like, repost, follow or reply.",
  typeTexts: ["NIW"],
  maxSteps: 12,
  collect: {
    record: "a post in the search results",
    fields: { author: "the display name or @handle of the poster", text: "the post's text" },
    judge:  { on_topic: "the post is about the EB-2 NIW immigration visa, not the word 'niw' used casually" },
    require: { on_topic: 0.7 },
    where: "the Latest tab of the search results",
    count: 5
  }
})
```

Poll `get_task_status(task_id, { wait_seconds: 30 })` until `done`.
`result.collected` is the list; each record also carries `p_on_topic`, the
probability the claim held, so you can sort or re-filter.

The same shape works in any app: change `launch`, the goal's labels, and
what a record is. Reddit's communities show one tall card per screen, so
give them `maxSteps: 24`.

Pure reading without navigation, when the list is already on screen:

```
phone_read({
  record: "a post in a social media feed, written by one account",
  fields: { user: "the account that posted it; prefer its @handle", text: "the body text of the post" },
  count: 10
})
```
