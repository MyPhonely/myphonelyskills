import assert from "node:assert/strict";
import { test } from "node:test";

import { inUS, judgeCard } from "../lib/cards.ts";
import type { CardFilter } from "../lib/common.ts";
import { pairFor, shortName, targetsFor } from "../lib/plan.ts";
import type { Agent } from "../lib/common.ts";

// Card shapes as LinkedIn's people search showed them on 2026-10-08; the
// names are made up.
const FILTER: CardFilter = {
  location: "us",
  headline_any: ["phd student", "phd candidate", "doctoral", "postdoc", "graduate student", "phd @", "phd at"],
  headline_none: ["professor", "scientist", "engineer", "researcher @", "founder"],
};

const keep = (headline: string, location = "Los Angeles, California, United States", name = "Alex Doe", pair?: string) =>
  judgeCard({ name, headline, location }, FILTER, pair);

test("a US location is read however LinkedIn writes it", () => {
  for (const l of ["Los Angeles Metropolitan Area", "Greater Seattle Area", "San Francisco Bay Area", "United States", "West Lafayette, Indiana, United States", "Austin, Texas, United States"]) {
    assert.ok(inUS(l), l);
  }
  for (const l of ["Haidian District, Beijing, China", "Mumbai, Maharashtra, India", "Greater Toronto Area, Canada", "Hong Kong, Hong Kong SAR", ""]) {
    assert.ok(!inUS(l), l);
  }
});

test("current PhD students and postdocs in the US are kept", () => {
  assert.ok(keep("Ph.D. Candidate at Purdue University").keep);
  assert.ok(keep("CS PhD Student @ UCDavis | Prev. Intern @ Google DeepMind").keep);
  assert.ok(keep("Ph.D. Student @ UMich | CSE Ex-Adobe Research | IIT Bombay 2021").keep);
  // A job named beside a current PhD is kept: the PhD says what they are now.
  assert.ok(keep("Civil Engineer | Ph.D. Student @Purdue University").keep);
});

test("people outside the US, past students and other jobs are dropped, with a reason", () => {
  assert.match(keep("Phd Scholar at IIT Bombay", "Mumbai, Maharashtra, India").reason, /not in the US/);
  assert.match(keep("Research Scientist @Meta, PhD @Purdue, Former Postdoc @Cornell").reason, /scientist/);
  assert.match(keep("Assistant Professor @ UCF | PhD @ UW-Madison").reason, /professor/);
  assert.match(keep("PhD, AI/ML Researcher | Googler").reason, /not a current one/);
});

test("a paired school that matched the person's name is dropped", () => {
  const v = keep("PhD Candidate @ Purdue MSE", "West Lafayette, Indiana, United States", "Muhammad Sharif Rahman", "Sharif University of Technology");
  assert.equal(v.keep, false);
  assert.match(v.reason, /matched the name/);
  // The same name with the school in the headline is a real match.
  assert.ok(keep("PhD Candidate @ Purdue | BS Sharif", "United States", "Muhammad Sharif Rahman", "Sharif University of Technology").keep);
});

test("a location list keeps only those places", () => {
  const socal: CardFilter = { ...FILTER, location: ["Los Angeles", "Irvine", "Riverside", "San Diego", "Orange County"] };
  assert.ok(judgeCard({ headline: "PhD student at UCR", location: "Riverside, California, United States" }, socal).keep);
  assert.match(judgeCard({ headline: "PhD student", location: "Austin, Texas, United States" }, socal).reason, /not in/);
});

test("pair searches each rotation value with today's paired schools, within the day's connects", () => {
  const agent = {
    id: "t",
    audience: {
      titles: ["PhD student"],
      rotate: { dimension: "school", per_day: 2, values: ["UCLA", "UC Irvine", "UC Riverside"], start: "2026-10-01" },
      pair: { values: ["Tsinghua University", "Peking University", "IIT Bombay", "KAIST"], per_day: 2, start: "2026-10-01" },
      card_filter: FILTER,
    },
    channels: { linkedin: { kind: "connect", connects_per_day: 9, batch_size: 3 } },
  } as unknown as Agent;
  const day = new Date(2026, 9, 1);
  assert.deepEqual(pairFor(agent, day), ["Tsinghua University", "Peking University"]);
  const plan = targetsFor(agent, "linkedin", day) as { dispatches: Array<{ query: string; pair_value: string }>; card_filter: unknown };
  assert.deepEqual(plan.dispatches.map((d) => d.query), ["PhD UCLA Tsinghua University", "PhD UC Irvine Tsinghua University", "PhD UCLA Peking University"]);
  assert.equal(plan.dispatches[0].pair_value, "Tsinghua University");
  assert.deepEqual(plan.card_filter, FILTER);
  assert.deepEqual(pairFor(agent, new Date(2026, 9, 2)), ["IIT Bombay", "KAIST"]);
});

test("{value_short} drops the generic words of a school's name", () => {
  assert.equal(shortName("University of Oklahoma"), "Oklahoma");
  assert.equal(shortName("Washington University in St. Louis"), "Washington in St. Louis");
  assert.equal(shortName("UC Irvine"), "UC Irvine");
  assert.equal(shortName("University of California, Los Angeles"), "California, Los Angeles");
  assert.equal(shortName("Caltech"), "Caltech");
});
