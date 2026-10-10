---
name: news-desk
description: Run one day of a news site's desk from a desk folder (desk.yaml, style.md) — collect what communities and official accounts posted on the user's real phone (Reddit, X, LinkedIn, forums in Chrome), keep the real news and the case reports the desk wants, check every fact against a primary source, write the day's articles as drafts or publish them to the site's API, and share the best of them to the site's own X account and subreddits. Use when asked to run the news, today's news run, or a news roundup for a site that has a desk folder.
kind: agent
title: Run a day of news for your site
apps: com.reddit.frontpage, com.twitter.android, com.linkedin.android, com.android.chrome
writes: true
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

**Collecting only reads the phone.** What leaves the machine: articles, in
publish mode; and, when the desk has a `share` section, a post about each
of the day's best articles on the site's own accounts (step 6), which stops
for the person's approval unless they have said otherwise.

## Inputs

| | |
|---|---|
| **desk** | the desk folder, e.g. `./news/my-site` |
| **mode** | `draft` (default): articles are written to `<records>/drafts/<date>/` for the user to read. `publish`: articles go to `desk.yaml`'s `publish` endpoint; only when the user has said so for this run or its schedule |
| **lanes** | which lanes to run, default all in `desk.yaml` (`news`, and `cases` if the desk has it) |

## Read the desk first

`desk.yaml`, `style.md`, and any other `.md` in the folder except
`README.md`, which is for people. `desk.yaml`
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

### 6. Share (only if `desk.yaml` has `share`, and only articles that are live)

Pick the day's strongest published articles, at most `share.max_per_day`,
and post each to the site's **own** accounts and communities listed under
`share`. Never anywhere else: other people's communities remove a site's
links and ban the account.

- **Reddit**, each community in `share.reddit.communities`: the
  `reddit-post` workflow, a **text post**: the article's headline as the
  title; as the body, 3-4 sentences with the key facts, then the article's
  link on its own line. An account that only ever posts links to one
  domain trips Reddit's spam filter, even in its own subreddits.
  **Then approve it** where `share.reddit.moderator` is true: open the new
  post (the subreddit's New feed, by link, then tap it) and look for the
  "Approved" badge under it. If it is there, done. If not, tap **Mod mode
  disabled** at the top of the post page to turn Mod mode on, tap
  **Approve post** (not Remove post, not Mark post as spam) and check
  "Post has been approved." and the badge. The post menu (⋯) has only the
  author's actions. If the post is missing from the feed, a filter took it:
  approve it from Mod Tools → Queues → Needs Review. Measured 2026-10-09:
  in r/quickfiling the post showed Approved at once; in r/immigraus it was
  live but unapproved and not in the queue, and Mod mode → Approve post
  approved it.
- **X**, `share.x`: one or two sentences, the fact first, then the link
  (under 280 characters; a link counts as 23). Open the composer already
  filled in, by link: `launch: com.twitter.android`, `openUrl`
  `https://x.com/intent/post?text=<the post, URL-encoded>`, and pause.
  Check the composer shows `share.x` as the account and the whole text,
  then tap Post once (two overlapping "Post" labels: either is the same
  button). Measured 2026-10-09: the `x-post` workflow's route, the floating
  button on the timeline, did not register and the operator scrolled
  instead; the intent link opened the composer filled in, and the post
  went out from @quickfiling2us.
- **LinkedIn**, `share.linkedin` (a company page the phone's member admins,
  and who reposts it): post **as the page**, then repost from the member.
  1. Open the page in admin view: `openUrl`
     `https://www.linkedin.com/search/results/companies/?keywords=<page>`, tap
     the result named in `share.linkedin.result` (another company can share
     the name), and dismiss a Premium offer if one covers it. Admin view
     shows Dashboard, Inbox and **Start a post**.
  2. Tap **Start a post** and stop: check the composer's avatar is the
     page's logo, not the member's photo, before typing. Type the post
     (headline, two short paragraphs, the link) and tap Post once; "Post
     successful" confirms.
  3. Find the post with a posts search for its headline in quotes, sorted by
     date. Check "Comment, react, and repost as" (the avatar left of Like)
     is set to `share.linkedin.repost_as`, then Repost → **Repost
     instantly**; "Repost successful" confirms. Instantly, so no words go
     out in the member's name.
  Measured 2026-10-09: the pause can fire on the wrong screen here too, so
  confirm each check from a screenshot.
- **Discord**, `share.discord` (a server and a channel the phone's account
  can post in): one `run_task` phase, `launch: com.discord`, goal "tap the
  <server> server icon in the left sidebar, tap the #<channel> text channel
  (not a voice channel), tap the 'Message #<channel>' bar", `pauseWhen` "the
  'Message #<channel>' box of the <server> server is focused and empty";
  then `resume_task` with `typeTexts: [<message>]`, `allowWrites: true`,
  `repeat: 1`, `countLabel: "^Send"` and a goal that types the message and
  taps the send arrow once (never Record Voice Message). The message: the
  headline in bold, two sentences, the link. Measured 2026-10-09: Discord's
  accessibility tree keeps reporting the channel-list drawer after a
  channel opens, so the pause can fire on the wrong screen and the operator
  can stall. Check the pause's screenshot shows the channel's own feed and
  its "Message #<channel>" box before resuming; an announcement channel is
  labelled "<channel> (announcement channel)", not "text channel".
- Write each post fresh from the article, as `style.md` says. Never the
  same text in two places.

Every share is a write from the brand's account, so it follows the
workflows' pause: with someone watching (`share.mode: review`, the
default), stop at each composer and post only on their yes. With no one
watching, write the posts to `<records>/share/<date>.md` instead and post
nothing; post unattended only when `share.mode` is `autopilot`. Record each
post that went out in `<records>/shared.jsonl` (`date`, `slug`, `where`)
and never share an article twice to the same place.

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
  news-desk for <desk> in draft mode"`. Without an outreach agent loaded,
  the extension keeps no reservations but still makes every share's phase
  pause and asks the person before the post goes out (unattended:
  `OUTREACH_UNATTENDED=1`, for `share.mode: autopilot` only).
- No reservations here: `published.jsonl` keeps a story from going out
  twice, `shared.jsonl` a share.
- `example/` is a complete fictional desk to copy.
