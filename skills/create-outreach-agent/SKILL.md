---
name: create-outreach-agent
description: Create an outreach agent for a brand — a folder with who to reach and where (agent.yaml), what may be said (brand.md) and how it sounds (voice.md) — by reading the brand's website and asking the owner a few questions, so outreach-day can run it every day. Use when someone wants to start outreach for their product, set up an outreach agent, or asks how to get outreach-day running for a new brand.
kind: agent
title: Create an outreach agent for your brand
apps:
writes: false
reviews: true
---

# Create an outreach agent for your brand

Sets up everything `outreach-day` needs to run a brand's outreach: who to
reach and where, what the brand may and may not say, and how it sounds. You
read the brand's website, ask its owner what a website cannot tell you, and
write the agent folder for them to review. Nothing touches the phone, and
nothing is sent.

## Inputs

| | |
|---|---|
| **site** | the brand's website, e.g. `acme.dev` |
| **folder** | where the agent goes, default `./outreach-agent` |
| **id** | a short name, lowercase with dashes, e.g. `acme-eng-leads` |

## Run it

Every command is `node <outreach-day's folder>/scripts/outreach.ts
<command>`; run `npm install --prefix <outreach-day's folder>/scripts` once
first. Below it is written `outreach`.

**1. Read the brand.** Fetch the site: the home page, pricing, the about
page, the FAQ or help center, the terms. Note, with the page each came from:
what the product is and is not, who it is for, prices and plans, any
promotion, claims the site itself makes, and anything regulated (health,
finance, legal, immigration, insurance, employment).

**2. Ask the owner** what the site cannot say, all at once, offering your
best guess for each from what you read:

- Who exactly to reach: job titles, or the kind of person, and where they
  are (a country, schools, industries, cities).
- Which channels and accounts: LinkedIn, X, Reddit (which subreddits),
  Facebook (which groups the account has joined), Xiaohongshu. Each needs
  the brand's account signed in on the phone.
- How many a day: suggest modest numbers (LinkedIn 10-15 invites a day and
  under 100 a week; 4-10 comments a day per channel) and say why.
- What must never be said: advice the product does not give, claims that
  would need a disclaimer, competitors not to mention.
- Who to skip: competitors, firms or vendors selling to the same audience.
- Review or autopilot: whether writes wait for them or go out within the
  limits. Recommend review until a few runs have been checked.

**3. Write the folder.**

```bash
outreach new --dir <folder> --id <id> --site <site> --label "<who, for what>"
```

Add `--records ~/.outreach/<id>` when the folder will live in a repo others
can read: the records hold people's names.

Then fill in every `CHANGEME` in the three files, from what you read and
what they answered:

- `agent.yaml`: `audience` (titles, `exclude_headlines`, the rotation of
  schools, industries or cities), the `channels` they chose, with keywords
  people actually use when they need the product (their words, not the
  brand's), `exclude_terms` for vendors' words, the daily limits, `order`,
  `offer` (prices exactly as on the site) and the warmup message, which
  takes its prices from `offer` as `{{min_price}}`, never typed in.
- `brand.md`: what the product is and, more important, what it is not; the
  facts that may be stated, with where each came from; what must never be
  said; the safe redirect for anything you are unsure of. Nothing the site
  does not say: no invented numbers, outcomes or testimonials.
- `voice.md`: what a comment is for (usually: earn the profile visit, not
  sell), the angles per kind of post, who to skip, and each channel's rules.

Anything else the agent should read before it writes (a list of help
articles to link, notes) goes in the folder as another `.md` file.

**4. Check it.**

```bash
outreach lint --agent <folder>
```

Fix what it lists until it says `ready`: placeholders left, a channel that
plans no searches, a message that does not render.

**5. Show the owner** the three files and a sample of what the agent would
write: two or three comments for posts you can imagine in their channels,
and the warmup message (`outreach message --agent <folder>`). Change what
they want changed. Then tell them how to run it: `outreach-day` with this
folder, interactively first, and their own scheduler (cron, or their AI's
scheduled tasks) once they trust it.

## What comes back

The agent folder, ready to run, and a short summary: who it reaches, on
which channels, how many a day, review or autopilot, and the commands to
run it.

## Notes

- `outreach-day/example/` is a complete fictional agent to compare against.
- Regulated products need the strictest `brand.md`: say exactly what the
  product is not, and give the redirect for anything that sounds like
  advice.
- Never put the owner's API keys, passwords or private data in the folder.
