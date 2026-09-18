# Writing a workflow

A workflow is a skill: one folder under `skills/`, one `SKILL.md`, one use
case. The frontmatter is what the listing on myphonely.ai is built from, and
the body is what an agent follows to do the job.

## Frontmatter

```yaml
---
name: x-collect-topic            # matches the folder, kebab-case, stable once published
description: Collect recent posts about a topic from X... Use when asked to...
kind: workflow                   # omit for a teaching skill like phone-operator
title: Collect posts about a topic on X
apps: com.twitter.android        # packages it touches, comma separated
writes: false                    # true if it can send, post, connect, like, follow or delete
reviews: false                   # true if it pauses for the user before acting
---
```

`description` is the field an agent reads when deciding whether this skill
applies, so say what it does **and when to reach for it**. Everything else is
for the catalog card.

## Body

Four sections, in this order.

1. **A paragraph** saying what it does and why it is worth doing on a phone.
   This is the listing copy.
2. **Inputs**, a table. Name each one, say what it is, give an example, and
   mark the default.
3. **Run it**, the actual tool calls with the inputs substituted in. Show the
   polling. If it pauses, show what the agent does at the pause and the resume
   call.
4. **What comes back**, then **Notes**: limits, failure modes, and what not to
   do.

## Rules that keep a workflow honest

- **Name every string that gets typed.** The operator selects, it never
  composes. A search query or a comment reaches the phone through `typeTexts`
  and nowhere else.
- **`allowWrites` goes on the call that writes,** never on navigation.
- **Anything a person would want to see first gets a `pauseWhen`,** and
  `reviews: true` in the frontmatter.
- **Say what not to do in the goal.** "Do not like, repost, follow or reply"
  is the difference between a read workflow and an accident.
- **One route per call.** More than about ten taps means split it.
- **Verify by effect, report the verified count.** A tap on Post is not a
  post; `result.sent` only lists writes whose effect showed on screen.
- **No accounts, keys, handles or private content** anywhere in the file.

## Before the pull request

```
node scripts/validate.mjs
```

It checks the frontmatter, that the folder and `name` agree, that a workflow
declares `writes` and `reviews` honestly against what its body does, and that
nothing looks like a key.

Then run it against your own phone. A workflow that has never touched a real
screen does not belong in the catalog.
