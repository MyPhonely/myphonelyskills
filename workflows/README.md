# Workflows

One workflow is one use case: a named, parameterized job that runs on a real
phone. Each file here is a listing in the catalog and the definition the
server runs, the way an Apify actor is both a store page and the thing that
executes.

A workflow is a JSON file, `<name>.json`, whose `name` matches the filename.

## The format

```json
{
  "name": "x-collect-topic",
  "title": "Collect posts about a topic on X",
  "summary": "Search X, switch to Latest, and read the newest posts with their authors.",
  "description": "Longer copy for the listing: what it does, what comes back, when to reach for it.",
  "apps": ["com.twitter.android"],
  "writes": false,
  "reviews": false,
  "estimatedCredits": [12, 25],
  "output": "A record per post: author and text, plus the probability the topic claim held.",
  "input": {
    "topic":  { "type": "string",  "required": true, "description": "What to search for", "example": "EB-2 NIW" },
    "count":  { "type": "integer", "default": 5, "min": 1, "max": 50, "description": "How many posts to keep" }
  },
  "phases": [ ... ]
}
```

| Field | Meaning |
|---|---|
| `name` | kebab-case id, matches the filename, stable once published |
| `title` | the card's heading, a use case not a feature |
| `summary` | one line for the card |
| `description` | a paragraph for the listing page |
| `apps` | Android packages it touches, first one is the app it starts in |
| `writes` | true when any phase can send, post, connect, like, follow or delete |
| `reviews` | true when it pauses for the user before acting |
| `estimatedCredits` | `[low, high]`, one credit per action the operator takes |
| `output` | what the caller gets back, in words |
| `input` | the parameters, see below |
| `phases` | what actually runs, in order |

### Input

Each parameter declares a `type` of `string`, `integer`, `boolean` or
`string[]`, plus `description`. Optional: `required`, `default`, `example`,
`min` and `max` for integers, `enum` for a fixed set. A parameter that is
neither required nor defaulted may be left out, and any `{{placeholder}}`
using it disappears with it.

### Phases

A phase is one route through one app. Two kinds:

- `"kind": "task"` navigates and acts. It may also read while it moves, with
  a `collect` spec.
- `"kind": "read"` reaches a list and extracts records from it.

| Phase field | Meaning |
|---|---|
| `title` | shown in progress |
| `goal` | the route in the app's own words: the labels to tap, in order, and what not to do |
| `launch` | package to force-stop and open first; set it on the first phase in an app |
| `steps` | waypoints in order, each a screen state that can be seen, not a gesture |
| `typeTexts` | every string this phase may type, verbatim; nothing else will be typed |
| `findTexts` | labels it may need to scroll to find |
| `allowWrites` | let this phase act on the world; only on the phase that does |
| `repeat`, `countLabel` | stop after N verified sends of the label this regex matches |
| `pauseWhen` | a screen condition to stop on, phone held, for the user to approve |
| `maxSteps` | step budget, about 12 for a search, 24 for a feed of tall cards |
| `collect` | `record`, `fields`, `count`, and optional `judge`, `require`, `where` |

Parameters substitute anywhere in a phase as `{{name}}`. A string that is
exactly `{{count}}` becomes the number.

## Rules that keep a workflow honest

- **Name every string that gets typed.** The operator selects, it never
  composes. A search query or a comment must reach `typeTexts`, usually from
  an input.
- **`allowWrites` goes on the write phase only,** never on navigation.
- **Anything a person would want to see first gets a `pauseWhen`.** Set
  `reviews` to true and say in `description` where it stops.
- **Say what not to do in the goal.** "Do not like, repost, follow or reply"
  is the difference between a read workflow and an accident.
- **One route per phase.** If a goal needs more than about ten taps, split it.
- **No accounts, keys, handles or private content** in any file here.

## Adding one

1. Write `workflows/<name>.json`.
2. Run `node scripts/validate.mjs`. It checks the shape, the filename, that
   every `{{placeholder}}` is declared, and that `writes` matches the phases.
3. Try it before opening the pull request. Until the workflow is deployed you
   can run it inline against your own phone by passing the definition and
   input to the `run_workflow` tool.

The listing on myphonely.ai is generated from these files, so `title`,
`summary`, `description` and `output` are the store copy. Write them for
someone deciding whether this does their job.
