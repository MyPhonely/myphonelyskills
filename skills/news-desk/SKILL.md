---
name: news-desk
description: Run one day of a news site's desk from a desk folder (desk.yaml, style.md) — collect what communities and official accounts posted on the user's real phone (Reddit, X, LinkedIn, forums in Chrome), keep the real news and the case reports the desk wants, check every fact against a primary source, and write the day's articles as drafts or publish them to the site's API. Use when asked to run the news, today's news run, or a news roundup for a site that has a desk folder.
kind: agent
title: Run a day of news for your site
apps: com.reddit.frontpage, com.twitter.android, com.linkedin.android, com.android.chrome
writes: false
reviews: true
---

# Run a day of news

A desk is a folder the user owns: where to look and what counts as news
(`desk.yaml`), how articles read (`style.md`), and the records of what was
already published (`records/`). This skill runs one day of it. The phone
does the reading through MyPhonely, using the app workflows in this repo;
you decide what is news, check it, and write it.

Any agent that can read a skill, call MCP tools, search the web and run a
shell command can run it: Claude Code, Codex, pi.

**Nothing on the phone is written.** Every phone task here only reads. The
one thing that leaves the machine is an article, and only in publish mode.

## Inputs

| | |
|---|---|
| **desk** | the desk folder, e.g. `./news/my-site` |
| **mode** | `draft` (default): articles are written to `<records>/drafts/<date>/` for the user to read. `publish`: articles go to `desk.yaml`'s `publish` endpoint; only when the user has said so for this run or its schedule |
| **lanes** | which lanes to run, default all in `desk.yaml` (`news`, and `cases` if the desk has it) |

## Read the desk first

`desk.yaml`, `style.md`, and any other `.md` in the folder. `desk.yaml`
holds the sources (app, where, how many), the lanes, the score bar, the
day's target, and the publish endpoint with its field names. `style.md`
overrides everything here on how an article reads and what it must never
say.

The records live where `desk.yaml`'s `records` says, default
`<desk>/records/`:

- `published.jsonl`, one line per article ever published:
  `{"date", "title", "source", "sourceUrl", "lane"}`. Read it before
  scoring: never publish the same story twice.
- `runs/<date>.md`, the day's log, written at the end.
- `drafts/<date>/`, one `.md` per article in draft mode.

## Run it

### 1. Collect

One source at a time, one phone task at a time, each **small**: at most
2-3 items per task and a short report. Long tasks are the ones that end
without their result.

**Open every source by link, never by typing into an app's search box.**
Put the link in the phase's `openUrl` with the app's `launch`, and start
the goal at the page it opens ("The results are open. Read…"). Typing a
search failed on X, LinkedIn and Reddit, every time, in both runs of
2026-10-09; the same searches opened by link all worked. URL-encode the
query (spaces as `%20`).

| app | `launch` | `openUrl` | workflow for the `collect` spec |
|---|---|---|---|
| Reddit, a subreddit | `com.reddit.frontpage` | `https://www.reddit.com/r/<sub>/new/` | `reddit-collect-subreddit` |
| Reddit, a search | `com.reddit.frontpage` | `https://www.reddit.com/search/?q=<query>&sort=new` | `reddit-search-posts` |
| X, a search or `from:<account>` | `com.twitter.android` | `https://x.com/search?q=<query>&f=live` | `x-collect-topic` |
| LinkedIn, posts | `com.linkedin.android` | `https://www.linkedin.com/search/results/content/?keywords=<query>&sortBy=%22date_posted%22` | `linkedin-post-search` |
| LinkedIn, a company's posts | `com.linkedin.android` | `https://www.linkedin.com/company/<slug>/posts/` (slugs that do not open are dropped from the desk) | `linkedin-post-search` |
| A forum | `com.android.chrome` | the forum page | the server's playbook (1point3acres) |

**Take the `collect` spec from that workflow's SKILL.md**, with the inputs
filled in: it is what tells the operator when it has read enough. A goal
with no `collect` scrolls until it runs out of steps (measured
2026-10-09). On Reddit read title, author, upvotes, any external link's
domain and the first lines of the body; never copy links in the app.

Give each a `claim` that says what the lane keeps, so the read filters on
the phone: for `news`, "the post reports an official announcement, a
policy, rule or fee change, visa-bulletin movement, a processing-time
change or a court ruling, not a personal case question"; for `cases`, what
`desk.yaml` says a case report is.

**Pinned highlights and link posts**: a subreddit's "Community highlights"
and a link post's title are leads, not stories. Note the title and search
for it on the web (step 4); the phone need not open them.

A source that fails or returns nothing is logged and skipped. One bad
source never stops the run.

### 2. Sort into lanes

**news.** Official announcements and changes that affect many readers.
Skip personal posts, questions, memes, ads and job posts. Returning zero
from a community is a correct answer: do not pad.

**cases** (only if the desk has it). People reporting their own outcomes
(an approval, an RFE, a denial) with whatever details they chose to share:
category, service center, dates, premium processing, field. These are not
news one by one: collect them and write **one roundup** when `desk.yaml`'s
`cases.min_reports` is reached, as its `cases.cadence` says (say, weekly).
In a roundup:

- **no names, handles or links to the person's post**, and nothing that
  identifies them (employer, lab, exact field when it is rare): report the
  facts, not the person;
- say it is self-reported and unverified, and give counts and ranges, not
  a promise ("of 12 approvals reported this week, 9 had no RFE");
- no advice on anyone's case.

Keep the cases you collected in `<records>/cases/<date>.jsonl` until they
go into a roundup, so a weekly cadence has the whole week.

### 3. Score and pick

Drop anything already in `published.jsonl` and merge the same story from
several sources. **Drop old news**: a story is news only if its primary
source is dated within `target.max_age_days` (default 3) or something new
happened to it in that window (a court order, an effective date, a new
FAQ); then the article is about that new thing. Pinned highlights are
often months old. Score each story on the desk's criteria (default:
newsworthiness 1-10 and how many readers it affects 1-10) and keep those at
or above `target.min_score`, official sources first, up to
`target.articles_per_day`.

### 4. Check, then write

For every story you keep, before writing a word:

1. **Find the primary source on the web**: the agency's page, the Federal
   Register, the court's ruling, the news article a link post points to.
   That is the `sourceUrl`, not the community post. Use your web search
   tool. With none, a shell still reaches the sources that matter most:
   the Federal Register's API (`curl
   'https://www.federalregister.gov/api/v1/documents.json?conditions[term]=<words>&order=newest'`)
   for any rule, and the agencies' news pages (`desk.yaml` may list them
   under `primary_sources`). No source found: drop the story.
2. **Check every fact you will state** (dates, numbers, form and rule
   names, who said it) against that source. A claim you could not check is
   left out, or the story is dropped.
3. Write it as `style.md` says, in the site's language: a headline of your
   own, a short description, the article, the categories and tags from
   `desk.yaml`. Translate sources in other languages; never copy a post's
   text.

### 5. Publish or draft

**draft** (default): write each article to `<records>/drafts/<date>/<n>-<slug>.md`
with the fields as front matter. Nothing is sent.

**publish**: send each article to `desk.yaml`'s `publish.url` with its
`publish.fields` mapping, one request per article, and check the response
says it was created. Append a line to `published.jsonl` for each one that
was. A failed request is logged; do not retry it blindly.

## What comes back

Write `<records>/runs/<date>.md` and report: each source `OK | EMPTY |
FAILED` with how many items it gave; how many stories after dedupe; how
many met the bar; each article's title, source and URL (or draft path);
the cases collected and whether a roundup went out; anything skipped
because its facts could not be checked.

## Notes

- A schedule runs this unattended: give the AI the desk folder, the skills
  and the MyPhonely server, and say `publish` in the prompt only when the
  user has decided to.
- **pi**: load `outreach-day/scripts/adapters/pi.ts` with `-e`. It connects
  MyPhonely from `MYPHONELY_API_KEY` with the phone's writing tools hidden,
  which is all a desk needs. pi has no web search of its own: install one
  (`pi install npm:pi-web-search` uses the current model's native search)
  and load it with `-e` too, since `--no-extensions` skips installed ones:
  `pi --no-extensions -e builtin:mcp -e <skills>/outreach-day/scripts/adapters/pi.ts
  -e ~/.pi/agent/npm/node_modules/pi-web-search --skill <skills> "Run
  news-desk for <desk> in draft mode"`.
- The phone only reads, so there is nothing to reserve; the records'
  `published.jsonl` is what keeps a story from going out twice.
- `example/` is a complete fictional desk to copy.
