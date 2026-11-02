---
name: threads-follow-replier-and-like-latest
description: Search Threads once, open one recent post, then follow one person who replied and, as a separate step, like one of their posts. Use when outreach should reach people who replied under a topic, without replying, reposting, quoting, messaging, following the author, or liking the source post.
kind: workflow
title: Follow Threads repliers and like their latest post
apps: com.instagram.barcelona
writes: true
reviews: true
---

# Follow Threads repliers and like their latest post

Searches Threads once and opens one recent post by its text or media. The
people who replied under that post are the audience. Each one is two short
writes: follow them, and only then like one of their own posts. The source
post is not liked and its author is not followed. Nothing is replied,
reposted, quoted, messaged or posted.

Stay inside Threads. Do not open a profile URL. `resume_task` with
`abandon: true` presses Back once as it leaves. After an abandon, look at
the screen before you press Back yourself.

## Foreground app

Every `run_task` opens an app as its first step even when the phase has no
`launch`. On 2026-11-02 that open resolved Threads to Instagram or looped
on the launcher icon. Do not use a task to open Threads.

Before every `run_task`, `resume_task`, `phone_scroll`, and `phone_tap_label`,
call `phone_screen` with no `lease_id` unless you are inside a lease you
just acquired. `current_app` must be `com.instagram.barcelona`. If it is
anything else, including `com.instagram.android` or the launcher, stop.
Do not call `run_task`. Do not press Back. Do not tap Discard, Save draft,
Start over, Keep editing, or Start new video. Do not `phone_kill_app`.
Say the foreground package and stop.

Every goal starts with: `Threads (com.instagram.barcelona) is the foreground
app. If it is not, stop without tapping and without opening an app.` A
follow or like whose goal omits that sentence is refused. Follow and Like
also match Instagram.

## Leases

`phone_status` before the first call, and again after `cancel_task`,
`phone_screen`, `phone_scroll`, `phone_open_app`, and `phone_press`. Those
calls can leave a lease for about 15 minutes. `cancel_task` does not
release the lease of a paused task.

If `busy` is true, or `leased` is true and the status names a holder
(`holder`, `owner`, `client`, `name`, or `by`), stop on that first status.
Say `phone busy:` and the holder. Do not poll, do not pass their
`lease_id` to any tool, and do not `release_phone` it. Six polls are only
for a lease with no named holder and `busy` not true. If the same holder
is still there on the second status, stop. That wait cannot outlast
someone who is renewing the lease.

`acquire_phone` only for a short read, never while a `run_task` is queued
or running. `release_phone` that id as soon as the read returns, and again
if a later `phone_status` still shows it. A lease you still hold blocks the
next task. The only `lease_id` you may pass or release is one
`acquire_phone` just returned to you.

## Polling

After every `run_task` and `resume_task`, poll
`get_task_status(task_id, wait_seconds: 30)` and **stop on the first**
status of `paused`, `done`, `failed`, `cancelled` or `expired`. Do not
wait only for `done`. A paused task is not still running: stop polling it.
Cap the wait at six polls (about three minutes), then use the last status.
On `paused`, the next call is `resume_task` on that same `task_id`, or
`abandon: true` if you are leaving it. Do not start a new `run_task` while
a task is paused; it queues behind the paused one and the screen is held.
On `failed`, do not poll again and do not repeat the same call.

## Inputs

| | |
|---|---|
| **account** | the handle that must be signed in, e.g. `@quickfiling`. Compared with the Profile tab, ignoring case and a leading @. No account: stop |
| **query** | one search keyword, not a post title, e.g. `NIW approved` |
| **name** | one replier's name, chosen at the pause, e.g. `Mina Chen` |

One name per follow, and one name per like.

## Run it

**1. Bring Threads to the front, then read who is signed in.** Nothing is
written. If no `account` was given, stop. Do not set `launch`. Do not
press Back first: Back on an Instagram draft dialog chooses Discard or
Start over.

`phone_status` first. A live holder is `phone busy`. Then one
`phone_open_app`. It can leave a lease: `phone_status` and `release_phone`
only an id this run acquired.

```json
phone_open_app({ "package_name": "com.instagram.barcelona" })
```

`phone_screen`. Continue only when `current_app` is
`com.instagram.barcelona` and, if `phone_open_app` returned `confirmed`,
that is true. If the foreground app is Instagram or the launcher, stop.
Do not call `run_task` to recover. Every later task omits `launch` and is
preceded by the same `current_app` check.

```json
run_task({
  "phases": [{
    "goal": "Threads (com.instagram.barcelona) is the foreground app. If it is not, stop without tapping and without opening an app. Do not open an app and do not tap a launcher icon. If a dialog asks 'Allow Threads to send you notifications?', tap Don't allow. Do not tap Allow. Do not tap Discard, Save draft, Start over, or Keep editing. Then tap Profile at the bottom right. Stop when that profile is open and the signed-in username is visible. Do not search. Do not tap Follow, Like, Reply, Repost or the composer.",
    "pauseWhen": "the signed-in Threads profile is open and its username is on screen",
    "pauseScreenshot": true,
    "maxSteps": 8
  }]
})
```

`pauseWhen` and `pauseScreenshot` belong on the `run_task` phase.
`resume_task` does not accept them. Stop polling when status is `paused`.
Read the username. It matches `account` only when the handle is the same,
ignoring case and a leading @. Anything else: `resume_task` with
`abandon: true` and that `task_id`, say which account was showing, and
stop. Do not search and do not follow.

**2. Search, then tap the query row, then Recent.** `outreach targets`
returns one source post per keyword, starting at a keyword that changes
with the date. The rest are `keywords_later`. A dry or all-firm keyword is
not the end of the day: go to the next dispatch.

`phone_screen` first. `current_app` must still be
`com.instagram.barcelona`. The profile task is paused. `resume_task` with
`abandon: true` (that presses Back once). Look. If the foreground app
changed, stop. Then a new task, no `launch`.

Typing the query lands on suggested accounts, not posts. The goal pauses
on that list. The next step, after the pause, is one tap on the row whose
text is exactly the query. Do not tap an account. Then, if Recent or
Latest is already on the post results, tap it. Skip a card whose author
is `<account>` (the signed-in handle, such as `@quickfilingus`) and skip a
law firm or promoter (law, lawyer, attorney, immigration, law office,
律所, 律师, 移民, 中介) without opening it. Open a remaining post by its
timestamp (`5d`, `3h`, `07/05`), the exact text. `phone_tap_label` takes
`text`. Do not tap a label shortened with `…`, and do not tap the post body.

```json
run_task({
  "phases": [{
    "goal": "Threads (com.instagram.barcelona) is the foreground app. If it is not, stop without tapping and without opening an app. Do not open an app. Tap Search in the bottom bar, tap the search field, type '<query>', and submit. Stop when the suggestion list is showing and a row whose text is exactly '<query>' is on screen. Do not tap an account. Do not tap Follow or Like. Do not tap Discard, Save draft, Start over, or Keep editing.",
    "typeTexts": ["<query>"],
    "pauseWhen": "Threads search suggestions for '<query>' are showing, including a row whose text is exactly '<query>'",
    "pauseScreenshot": true,
    "maxSteps": 12
  }]
})
```

Stop on `paused`. Confirm `current_app` is still
`com.instagram.barcelona`. Then:

```json
resume_task({
  "task_id": "<id>",
  "goal": "Threads (com.instagram.barcelona) is the foreground app. If it is not, stop without tapping and without opening an app. Tap the row whose text is exactly '<query>'. Do not tap an account. If a chip labelled Recent or Latest is then visible, tap it once. If it is not visible, leave the results. Skip cards by <account> and skip law-firm and promoter cards without opening them. Open one remaining post by tapping its timestamp, the exact text such as 5d or 07/05. Do not tap the author name, the post text, or a label that contains an ellipsis. On the post, scroll until one reply row is on screen, name and reply text both visible. Do not tap Follow, Like, Reply, Repost, or Quote.",
  "maxSteps": 14
})
```

Stop polling when status is `paused`. Read the age, the whole post text,
and each reply that is on screen. `outreach age` accepts Threads' compact
ages (`5d`, `3h`, `2w`) and a month/day date (`07/05`, `07/05/2025`). Keep
the reply text. The post itself has to be an employment case: its text
must contain NIW, EB-1A, EB1A, I-140, or EB-2. A search keyword is not the
post. Skip a family or marriage post, and a reply, whose text contains
married, spouse, wife, husband, marriage, K-1, or I-130. `reserve` refuses
both. Reserve nothing before that check.

A reply below the fold is not a row you can tap. After this task has
finished or been abandoned, and only with a lease you release before the
next task, scroll the replies until you have `repliers_per_post` audience
repliers or the list ends:

```json
phone_scroll({ "direction": "down" })
```

`phone_scroll` takes `direction` only (`down`, `up`, `left`, or `right`).
There is no distance. `down` reveals the next screenful. `phone_screen`
after each scroll. If the elements are unchanged, the list has ended.
`phone_swipe` is refused. Do not stop at two repliers while a third is
still below the fold and the cap is 3.

**3. Choose one name.** Skip the author, the signed-in account, and an
agency, law firm or promoter. Skip a name or a bio that contains lawyer,
attorney, law firm, immigration consultant, 中介, 移民, 律师, 律所, or
咨询. Skip a reply that advertises a service or says DM me, 私信, or
欢迎咨询, including "I am a lawyer" and "our law firm". Do not skip a
reply that asks for a lawyer recommendation: 求律师, 求推荐, "looking for
a lawyer", "lawyer recommendation". That person is the audience. Read the
chosen reply from the screen and keep those words before any tap on their
avatar. `outreach check` now. Reserve in step 4, after the bio is on
screen and before Follow is tapped. Pass the source post text as
`--title` (not just a couple of words: the topic check reads it), the
reply as `--body`, and the bio as `--bio`. The same reply goes on the
follow record as `--note`, and the same source text is `--title` again.
If the record omits `--title`, the ledger keeps the text from reserve.

**4. Open the profile, then follow, and do not call it done early.** The
post task is paused. Resume it to open the profile. Do not abandon it:
abandon presses Back and leaves the post. `resume_task` has no
`pauseWhen`, so this resume runs until it stops, and `phone_screen` is
how you read the profile. The reply row has to be on screen. Writes stay
off, so Follow is not tapped yet.

```json
resume_task({
  "task_id": "<id>",
  "goal": "Threads (com.instagram.barcelona) is the foreground app. If it is not, stop without tapping and without opening an app. On the open Threads post, scroll until the reply by <name> is fully on screen, name and reply text included. Read that reply. Do not tap a row that is off screen. Tap that replier's avatar. Stop when their profile is open and the button reads Follow, Following, 关注, or 已关注. Do not tap that button. Do not press Back. Do not search. Do not tap Reply. Do not tap Discard, Save draft, Start over, or Keep editing.",
  "maxSteps": 10
})
```

Stop polling on `done` or `failed`. `phone_screen`, after `phone_status`
says the phone is not leased. The follow is done only when that button
reads Following or 已关注. The task status does not decide this: `done`
with the button still on Follow is not a follow, and `failed` can still be
a success if the button changed. The profile's own following count is how
many people they follow. It does not change when you follow them.
`phone_screen` is the check. Release the lease before the next task.

Read the bio now, before any reserve. If the name or the bio contains
lawyer, attorney, law firm, immigration consultant, 中介, 移民, 律师,
律所, or 咨询, do not reserve and do not tap Follow. One Back, then look.
`outreach reserve` the follow only when the name, the bio and the reply
are all allowed. Pass `--bio` with the bio on screen. A refusal (exit 3)
means one Back, then the next replier. There is no reservation to release.

If the button already reads Following or 已关注, do not tap. Record the
reserved follow as sent, with `--note` set to the reply you read on the
post, `--title` set to the source post text, and `--url` set to their
profile.

If it reads Follow or 关注, the previous task has finished, so a new task
may start. No `launch`. This task is not a success until the button changes:

```json
run_task({
  "allow_writes": true,
  "phases": [{
    "allowWrites": true,
    "repeat": 1,
    "countLabel": "^(Follow|关注)$",
    "goal": "Threads (com.instagram.barcelona) is the foreground app. If it is not, stop without tapping and without opening an app. The Threads profile of <name> is open. If the button reads Following or 已关注, do not tap it; stop. If it reads Follow or 关注, tap it exactly once. Then read the button. Stop when it reads Following or 已关注. If it still reads Follow or 关注, stop without tapping again; this follow is not done. Do not press Back, do not open a post, and do not tap Reply.",
    "pauseWhen": "the Threads profile of <name> is open and the button reads Follow, Following, 关注, or 已关注",
    "maxSteps": 6
  }]
})
```

The phase pauses on the profile. The write is `resume_task` with
`task_id`, `allowWrites: true`, `repeat: 1`, and `countLabel`
`^(Follow|关注)$`. Do not pass `pauseWhen` or `pauseScreenshot` to
`resume_task`. Then look again.

Sent only when a screen read shows Following or 已关注. Pass
`--note "<the reply>"` on that record. If the button still reads Follow or
关注, or the profile never opened, the follow is not done. `outreach
release` that reservation and `reserve` it once more, then repeat this tap
once. Do not `record failed` on the first miss. The second miss is
`record failed`, and there is no third try.

**5. Like one of their posts, as its own step.** No `launch`. Their posts
are on the profile, under the bio. Scroll to them with
`phone_scroll({ "direction": "down" })`. Do not tap the Threads or Media
tab to go looking: on 2026-11-02 those taps did not switch the tab, and
Media still read "No media threads yet" without the tab changing. A tab
counts as switched only when a later `phone_screen` shows that tab
selected or the list content changed. "No posts" is a skip only after that
visible change and a further scroll that leaves the elements unchanged.

Open a post by its timestamp. `phone_tap_label` takes `text`, and the
match is the exact full label. A timestamp such as `5d` or `07/05` is that
label. A post-body label shortened with `…` never matches, and a direct
tap on long post text is refused. Prefer a single-item post, one Like
control. Skip a poll or a multi-item thread when another post is a single
item. Do not `phone_swipe`. `release_phone` before you start the task. Do
not hold that lease while the task is queued. Do not tap a heart that is
already filled. A floating chat bubble covers the bottom-left heart: do
not tap a heart hidden under it.

```json
run_task({
  "phases": [{
    "goal": "Threads (com.instagram.barcelona) is the foreground app. If it is not, stop without tapping and without opening an app. You are on <name>'s profile inside Threads. Do not search and do not open a link or Chrome. Do not tap the Threads or Media tab. Scroll until their posts are on screen. Prefer a single-item post. Open it by tapping its timestamp, the exact text such as 5d or 07/05, not their name and not the post text. Stop when that post is open and its first Like is on screen. Do not tap Like, the heart, Reply, Repost or Quote.",
    "pauseWhen": "a single-item post by <name> is open, or the first item of a thread is open, and a Like label is on screen",
    "pauseScreenshot": true,
    "maxSteps": 8
  }]
})
```

Stop polling on `paused`. If the heart is filled, or the control reads
Liked, Unlike, or 已赞, do not reserve a like and do not tap it.
`resume_task` with `abandon: true` and `task_id` presses Back once. Look.
You may open the next post the same way, once. If that heart is filled
too, stop without a like.

If the first item's control reads `Like` or `Like 7` (or 赞 with a count)
and the heart is empty, reserve the like. Pass their name as `--author`,
the text of the post you actually opened as `--title`, and its URL as
`--url` when it is on screen. A later record with a different `--title`
stores that new title, not the one from reserve. Then:

```json
resume_task({
  "task_id": "<id>",
  "allowWrites": true,
  "repeat": 1,
  "countLabel": "^(Like( \\d+)?|赞( \\d+)?)$",
  "goal": "Threads (com.instagram.barcelona) is the foreground app. If it is not, stop without tapping and without opening an app. The post is open. Tap the first item's Like once. The label may be Like or Like 7, or 赞 with a count. Do not tap a later item's Like. Do not tap a heart that is filled, covered by the floating chat bubble, or labelled Liked, Unlike, or 已赞. Then stop. Do not tap again even if the count looks unchanged. A second tap removes the like. Do not tap Reply.",
  "maxSteps": 5
})
```

If the heart has no label and it is empty, do not resume into more
scrolling. Reserve the like first. Then **one** `phone_tap` on the center
of that heart and no other coordinate. The guard allows that tap once while
the like reservation is held and refuses a second tap, a tap with no like
reservation, and a tap after this one. Then `phone_screen` once. Do not
tap again whatever it shows.

Record from a screen read, not from the task status and not from `sent`.
A like task often returns `sent: []` after a like that took. A filled
heart, Liked, or a count one higher means sent. Otherwise release once if
nothing was tapped, or record failed if the second look still shows an
empty heart.

**6. Back one screen at a time.** No `launch`, no search, no "until".

```json
run_task({
  "phases": [{
    "goal": "Threads (com.instagram.barcelona) is the foreground app. If it is not, stop without tapping and without opening an app. Press the in-app Back control exactly once, then stop immediately. Do not press Back a second time. Do not press Back on a Discard, Save draft, or Start over dialog. Do not tap Search and do not open a link.",
    "maxSteps": 3
  }]
})
```

A Back task often ends `failed` or `stuck` after a Back that landed. That
status is not the outcome. `phone_screen` is. If you abandoned a paused
task to get here, that abandon already pressed Back once, so this may
already be the profile or the source post. Do not press Back again until
you have looked.

- The replier's profile is showing: one more task, the same single Back, then look again.
- The source post is showing, with its replies: stop. You are back. Scroll to the next reply only if you still need another replier.
- The search results for the keyword are showing: stop. Do not search.
- Home, or the search field with no results: you went too far. Stop. Do not press Back again and do not type the keyword again.

From the liked post the return is two Backs (their post, then their
profile, then the source post), unless an abandon already used one of
them. A further Back leaves the results. The next name starts from the
source post's replies. The next post in the search is one single Back from
the source post to the results, then the next card, still with no new
search.

## What comes back

The task status and `sent` do not decide the record. `phone_screen` does.
A follow is sent only when the button reads Following or 已关注. The
record's `--note` is the reply you read before opening the profile, and
`--title` is the source post text. A task that ended with the button still
reading Follow is not a follow: release it and retry once. A like is sent
when the first item's heart is filled, the label reads Liked, or that
count is one higher, even when `sent` is empty and even when a Back task
reported failed. One tap only. Pass `--title` of the post that was
actually liked. Record their profile URL on the follow and the liked
post's URL when they are on screen.

## Notes

- **The account is checked before any search.** Profile is the bottom-right
  tab. A different handle stops the run. There is no second account to try.
- **Don't allow on the notification dialog.** The first launch can ask
  "Allow Threads to send you notifications?". Tap Don't allow. Do not tap
  Allow, and do not treat that dialog as the profile.
- **No `launch`, and no task that opens the app.** `phone_open_app` with
  `package_name` `com.instagram.barcelona`, then `phone_screen`.
  `current_app` must be that package before every task. Instagram or the
  launcher means stop. Do not press Back on Discard, Save draft, Start
  over, or Keep editing, and do not kill Instagram. `resume_task` takes
  `task_id`, `goal`, `typeTexts`, `allowWrites`, `repeat`, `countLabel`,
  `maxSteps`, and `abandon`. It does not take `pauseWhen` or
  `pauseScreenshot`.
- **A live holder is `phone busy`.** One `phone_status` that names a
  holder, or `busy: true`, stops the run. Say who holds it. Do not wait
  them out. `cancel_task` and the screen tools can leave a 15-minute
  lease: `release_phone` only an id this run acquired.
- **Poll paused, then resume or abandon.** Waiting only for `done` holds a
  paused task. On `paused`, `resume_task` that task or abandon it. Do not
  start another task while one is paused. A new pause is a new `run_task`.
- **The timestamp opens the post.** `phone_tap_label` `text` is the exact
  full timestamp. An ellipsis is not a label. The author name opens the
  author. The author is not followed, and the source post's heart is not
  the like.
- **The post text has to be NIW, EB-1A, EB1A, I-140, or EB-2.** The search
  keyword is not the post. Skip married, spouse, wife, husband, marriage,
  K-1, and I-130 in the post or the reply.
- **Scroll until `repliers_per_post` or the list ends.** `phone_scroll`
  `direction` `down`, then look. An unchanged screen is the end.
- **Read the reply, then the profile.** The reply text is stored with the
  follow, and the source post text is the title column. A name or bio with
  lawyer, attorney, law firm, immigration consultant, 中介, 移民, 律师,
  律所, or 咨询 is not followed. A reply that asks for a lawyer
  recommendation is the audience. A reply that says DM me, or that the
  writer is a lawyer or a firm, is not.
- **Following is the follow.** The button has to read Following or 已关注.
  The number on the profile is how many people they follow.
- **Their posts are below the bio.** Do not treat an unmoved Threads or
  Media tab as an empty profile. Open a single-item post by its timestamp.
- **The first Like, one tap.** `countLabel` is `^(Like( \d+)?|赞( \d+)?)$`,
  so `Like 7` on item 1 counts and item 2 does not. A filled heart is never
  tapped. A heart under the floating chat bubble is not tapped. A second
  tap takes the like off. The record title is the post that was liked.
- **One Back, then look. Abandon is a Back.** `resume_task` with
  `abandon: true` presses Back once. Look before you add another.
- **`phone_scroll` takes `direction` only.** `phone_swipe` is refused.
  Release the lease before the next task. Another holder's lease is not
  yours to use or release. Six `phone_status` polls, then stop.
- **Seen on a phone, 2026-11-02, twice.** The first run followed repliers
  and liked one post, and also followed off a marriage post. The second
  run wrote nothing: tasks opened Instagram or the launcher, search stopped
  on suggested accounts, and the only keyword was firms and old posts.
  What this revision still needs on a phone: `current_app` stays
  `com.instagram.barcelona` through a search, the query row then Recent
  shows posts, the next keyword runs when the first is firms or too old,
  and a follow and a like happen only while that package is in front.
