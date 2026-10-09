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
without their result. Use the workflow for each app:

| app | workflow | notes |
|---|---|---|
| Reddit | `reddit-collect-subreddit` (a subreddit, sort New) or `reddit-search-posts` | read title, author, upvotes, any external link's domain, the first lines of the body. Do not copy links in the app: resolve them on the web later |
| X | `x-collect-topic` | the desk's searches, Latest; `from:<account>` for official accounts |
| LinkedIn | `linkedin-post-search`, or a company page's Posts tab | official pages first |
| Forums | a `run_task` that opens the forum page in Chrome (`launch: com.android.chrome`, `openUrl`) and reads the first page of threads | the server's playbook covers 1point3acres |

Give each a `claim` (or a goal sentence) that says what the lane keeps, so
the read filters on the phone: for `news`, "the post reports an official
announcement, a policy, rule or fee change, visa-bulletin movement, a
processing-time change or a court ruling, not a personal case question";
for `cases`, what `desk.yaml` says a case report is.

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
several sources. Score each story on the desk's criteria (default:
newsworthiness 1-10 and how many readers it affects 1-10) and keep those at
or above `target.min_score`, official sources first, up to
`target.articles_per_day`.

### 4. Check, then write

For every story you keep, before writing a word:

1. **Find the primary source on the web**: the agency's page, the Federal
   Register, the court's ruling, the news article a link post points to.
   That is the `sourceUrl`, not the community post.
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
  which is all a desk needs: `pi --no-extensions -e builtin:mcp -e
  <skills>/outreach-day/scripts/adapters/pi.ts --skill <skills> "Run
  news-desk for <desk> in draft mode"`.
- The phone only reads, so there is nothing to reserve; the records'
  `published.jsonl` is what keeps a story from going out twice.
- `example/` is a complete fictional desk to copy.
