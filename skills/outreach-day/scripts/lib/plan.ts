/**
 * Turn an agent's agent.yaml into today's concrete targets and rendered messages.
 *
 *   outreach.ts channels                       # the run plan: order + kind
 *   outreach.ts targets --channel <name>       # today's dispatches for a channel
 *   outreach.ts message --name warmup          # rendered from offer:
 *   outreach.ts show                           # the agent: files, records, today's rotation
 *
 * Deterministic: `targets` is a pure function of agent.yaml and the date, so
 * re-running a given day reproduces that day's list exactly. No state file.
 */

import { brandFiles, die, emit, loadAgent, parse, splitCommand, stateDir } from "./common.ts";
import type { Agent, Rotation } from "./common.ts";

// Fixed epoch for the targeting rotation. Arbitrary but must never change:
// moving it reshuffles which values a given date maps to.
export const EPOCH = Date.UTC(2026, 0, 1);

const DAY = 86_400_000;

function daysSince(d: Date, start: number): number {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / DAY);
}

/** `rotate.start` as epoch ms, or the global EPOCH when absent. */
function startOf(start: string | undefined): number {
  if (!start) return EPOCH;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(start));
  if (!m) die(`rotate.start must be YYYY-MM-DD, got ${JSON.stringify(start)}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export interface NormalRotation {
  dimension: string;
  per_day: number;
  values: string[];
  /** Epoch ms of the day the first block runs. */
  start: number;
}

/**
 * The declared rotation dimension, normalized.
 *
 * Targeting strategy is DATA, not code. One product rotates through
 * universities; another by industry, company or city. So agent.yaml declares what
 * to cycle through, and this module stays strategy-agnostic.
 *
 * Accepts the legacy `audience.schools` shape so configs verified against live
 * data keep producing the identical daily slice.
 */
export function rotation(agent: Agent): NormalRotation {
  const aud = agent.audience;
  const rot: Rotation | undefined = aud.rotate;
  if (rot) {
    return {
      dimension: rot.dimension ?? "school",
      per_day: Number(rot.per_day ?? 6),
      values: [...(rot.values ?? [])],
      // An ordered list (say, nearest region first) only runs in that order
      // from a known day. Without `start`, today lands wherever the global
      // EPOCH puts it, which may be the middle of the list.
      start: startOf(rot.start),
    };
  }
  if (aud.schools?.length) {
    return { dimension: "school", per_day: Number(aud.schools_per_day ?? 6), values: [...aud.schools], start: EPOCH };
  }
  return { dimension: "none", per_day: 0, values: [], start: EPOCH };
}

/** This date's slice. Pure function of the values list and the date. */
export function rotationFor(agent: Agent, d: Date): string[] {
  const { values, per_day: perDay, start } = rotation(agent);
  if (!values.length || perDay <= 0) return [];
  // Ceiling, not floor: with 5 values taken 2 a day, floor gives 2 blocks and
  // the 5th value is never reached. The last block is short, which is fine.
  const blocks = Math.max(1, Math.ceil(values.length / perDay));
  const idx = (((daysSince(d, start) % blocks) + blocks) % blocks) * perDay;
  return values.slice(idx, idx + perDay);
}

/**
 * A school's distinctive words: "University of Oklahoma" -> "Oklahoma". In a
 * two-school search the shared word "University" dilutes the match: measured
 * 2026-10-08, "PhD University of Oklahoma Tsinghua University" returned people
 * still in China, "PhD Oklahoma Tsinghua" people in Oklahoma.
 */
export function shortName(school: string): string {
  const s = school.replace(/\b(The|University( of)?|College( of)?)\b/gi, " ").replace(/\s+/g, " ").trim();
  return s || school;
}

/** Today's paired values (audience.pair), rotating like rotate.values. */
export function pairFor(agent: Agent, d: Date): string[] {
  const pair = agent.audience.pair;
  const values = pair?.values ?? [];
  const perDay = Number(pair?.per_day ?? 4);
  if (!values.length || perDay <= 0) return [];
  const blocks = Math.max(1, Math.ceil(values.length / perDay));
  const idx = (((daysSince(d, startOf(pair?.start)) % blocks) + blocks) % blocks) * perDay;
  return values.slice(idx, idx + perDay);
}

const num = (v: unknown, fallback: number): number => (v === undefined || v === null ? fallback : Number(v));

export interface Dispatch {
  query?: string;
  search_term?: string;
  connects?: number;
  rotate_by?: string;
  rotation_value?: string;
  /** The paired value searched with rotation_value (audience.pair). */
  pair_value?: string;
  source?: string;
  keyword?: string;
  posts?: number;
  scope?: string;
  list?: string;
}

/** Dispatch plan for a `kind: connect` channel (LinkedIn-shaped). */
export function connectTargets(agent: Agent, channel: string, d: Date): Record<string, unknown> {
  const ch = agent.channels[channel];
  const titles = agent.audience.titles;
  const rot = rotation(agent);
  const sliceToday = rotationFor(agent, d);
  const batch = num(ch.batch_size, 3);
  const target = num(ch.connects_per_day, 20);

  // Every title against every value, not a positional zip: zipping paired
  // value[i] with title[i] only, so "head of engineering fintech" was never
  // searched while "engineering manager fintech" was searched twice.
  const dispatches: Dispatch[] = [];

  // Two ways to find the same kind of person, feeding the same pipeline.
  //
  //   people          search People by job title, crossed with the rotation.
  //   post_engagement search Posts by topic and read who reacted or commented.
  //
  // The second finds people who have shown interest in the topic rather than
  // people who merely hold a title, so it carries intent that a title search
  // cannot. Everything after the scan -- qualify, connect, quota, harvest,
  // warmup -- is identical, so this is a source setting and not a new channel.
  const source = typeof ch.source === "string" ? ch.source : "people";
  if (source === "post_engagement") {
    const keywords = Array.isArray(ch.post_keywords) ? (ch.post_keywords as string[]) : [];
    if (!keywords.length) {
      die(`channel ${channel} has source: post_engagement but no post_keywords`);
    }
    for (const kw of keywords) {
      dispatches.push({ query: kw, search_term: kw, connects: batch, source });
      if (dispatches.reduce((s, p) => s + (p.connects ?? 0), 0) >= target) break;
    }
    return {
      date: iso(d),
      platform: channel,
      kind: "connect",
      source,
      rotate_by: rot.dimension,
      rotation_today: sliceToday,
      batch_size: batch,
      connects_target: target,
      warmups_target: num(ch.warmups_per_day, 10),
      withdraw_after_days: num(ch.withdraw_after_days, 15),
      withdraw_per_run: num(ch.withdraw_per_run, 25),
      weekly_invite_cap: num(ch.weekly_invite_cap, 100),
      dispatches,
    };
  }

  // Two schools per search: a person with both on their profile is, most of
  // the time, at the first now with a degree from the second. Measured
  // 2026-10-08: 52 of 59 cards were in the US, against 0 of 10 for the
  // foreign school alone; the cards then go through card_filter.
  const pairToday = pairFor(agent, d);
  if (pairToday.length) {
    const template = agent.audience.pair?.query ?? "PhD {value} {pair}";
    const values: Array<string | null> = sliceToday.length ? sliceToday : [null];
    // Interleave so a short day still spans several US schools.
    outerPair: for (const paired of pairToday) {
      for (const value of values) {
        const query = template
          .replace("{value_short}", shortName(value ?? ""))
          .replace("{value}", value ?? "")
          .replace("{pair}", paired)
          .replace(/\s+/g, " ")
          .trim();
        const entry: Dispatch = { query, search_term: query, connects: batch, pair_value: paired };
        if (value !== null) {
          entry.rotate_by = rot.dimension;
          entry.rotation_value = value;
        }
        dispatches.push(entry);
        if (dispatches.reduce((s, p) => s + (p.connects ?? 0), 0) >= target) break outerPair;
      }
    }
    return {
      date: iso(d),
      platform: channel,
      kind: "connect",
      source,
      rotate_by: rot.dimension,
      rotation_today: sliceToday,
      pair_today: pairToday,
      card_filter: agent.audience.card_filter ?? null,
      batch_size: batch,
      connects_target: target,
      warmups_target: num(ch.warmups_per_day, 10),
      withdraw_after_days: num(ch.withdraw_after_days, 15),
      withdraw_per_run: num(ch.withdraw_per_run, 25),
      weekly_invite_cap: num(ch.weekly_invite_cap, 100),
      dispatches,
    };
  }

  const pool: Array<string | null> = sliceToday.length ? sliceToday : [null];
  outer: for (const value of pool) {
    for (const term of titles) {
      // The rotation value goes INTO the search text. The server's LinkedIn
      // playbook says never to open the Filters panel for outreach: it is the
      // most common reason a connect run sends nothing.
      const entry: Dispatch = {
        query: value ? `${term} ${value}` : term,
        search_term: term,
        connects: batch,
      };
      if (value !== null) {
        entry.rotate_by = rot.dimension;
        entry.rotation_value = value;
      }
      dispatches.push(entry);
      if (dispatches.reduce((s, p) => s + (p.connects ?? 0), 0) >= target) break outer;
    }
  }

  return {
    date: iso(d),
    platform: channel,
    kind: "connect",
    source,
    rotate_by: rot.dimension,
    rotation_today: sliceToday,
    batch_size: batch,
    connects_target: target,
    warmups_target: num(ch.warmups_per_day, 10),
    withdraw_after_days: num(ch.withdraw_after_days, 15),
    withdraw_per_run: num(ch.withdraw_per_run, 25),
    weekly_invite_cap: num(ch.weekly_invite_cap, 100),
    dispatches,
  };
}

/** Dispatch plan for a `kind: comment` channel (social-shaped). */
export function commentTargets(agent: Agent, channel: string, d: Date): Record<string, unknown> {
  const ch = agent.channels[channel];
  const n = num(ch.posts_per_keyword, 3);
  // Facebook (and any channel with `source: groups`) is not a keyword search.
  // Posts come from each joined group, sorted Newest — never the home timeline.
  const source = String(ch.source ?? (channel === "facebook" ? "groups" : "keywords"));
  if (source === "groups") {
    const groupKeywords = ((ch.group_keywords as string[] | undefined) ?? (ch.keywords as string[] | undefined) ?? []).filter(Boolean);
    return {
      date: iso(d),
      platform: channel,
      kind: "comment",
      source: "groups",
      sort: "newest",
      home_timeline: false,
      max_age_hours: num(ch.max_age_hours, 24),
      unanswered_only: ch.unanswered_only !== false,
      anonymous: Boolean(ch.anonymous),
      lang: (ch.lang as string) ?? "en",
      posts_per_group: n,
      group_keywords: groupKeywords,
      dispatches: [{ scope: "your_groups", keyword: groupKeywords.join(" | "), posts: n }],
    };
  }
  const dispatches: Dispatch[] = [];
  // A channel with `targets` scopes each keyword to a sub/forum (Reddit-shaped);
  // otherwise keywords are searched globally.
  const scoped = ch.targets as Array<{ keyword: string; sub?: string }> | undefined;
  if (scoped?.length) {
    for (const t of scoped) {
      const entry: Dispatch = { keyword: t.keyword, posts: n };
      if (t.sub) entry.scope = t.sub;
      dispatches.push(entry);
    }
  } else {
    for (const kw of (ch.keywords as string[] | undefined) ?? []) dispatches.push({ keyword: kw, posts: n });
  }
  // `lists` reads a curated list's timeline instead of a search (X-shaped):
  // the people are already chosen, so the posts are far less noisy.
  const lists = ((ch.lists as string[] | undefined) ?? []).map((list): Dispatch => ({ list, posts: n }));
  dispatches.unshift(...lists);
  // `exclude_terms` goes into the search text as -"term", which drops most
  // vendor posts before anyone reads them.
  const exclude = ((ch.exclude_terms as string[] | undefined) ?? []).filter(Boolean);
  for (const dsp of dispatches) {
    if (!dsp.keyword) continue;
    dsp.query = [dsp.keyword, ...exclude.map((t) => (/\s/.test(t) ? `-"${t}"` : `-${t}`))].join(" ");
  }
  // `comments_per_day` is a ceiling across every dispatch: trim from the end,
  // so lists and the first keywords keep their share.
  const cap = ch.comments_per_day === undefined ? Infinity : num(ch.comments_per_day, 0);
  let left = cap;
  const capped: Dispatch[] = [];
  for (const dsp of dispatches) {
    if (left <= 0) break;
    const posts = Math.min(dsp.posts ?? n, left);
    capped.push({ ...dsp, posts });
    left -= posts;
  }
  const plan: Record<string, unknown> = {
    date: iso(d),
    platform: channel,
    // A channel named `<app>-<stream>` (x-papers) runs in <app>, and the
    // ledger files it under <app>, so check-post spans every stream.
    app: channel.split("-")[0],
    kind: "comment",
    source: "keywords",
    lang: (ch.lang as string) ?? "en",
    posts_per_keyword: n,
    dispatches: capped,
  };
  // Passed through for the goal text; the kit does not interpret them.
  if (ch.tab) plan.tab = ch.tab;
  if (ch.max_post_age_hours !== undefined) plan.max_post_age_hours = num(ch.max_post_age_hours, 0);
  if (cap !== Infinity) plan.comments_per_day = cap;
  if (ch.dm) plan.dm = ch.dm;
  // `follow: true` follows each author whose post is replied to. `angle`
  // names the brand-voice angle every reply in this stream takes.
  if (ch.follow) plan.follow = true;
  if (ch.angle) plan.angle = ch.angle;
  return plan;
}

const ALIASES: Record<string, string> = { xhs: "xiaohongshu", "小红书": "xiaohongshu", twitter: "x", li: "linkedin" };

export function resolveChannel(agent: Agent, name: string): string {
  const key = ALIASES[name.toLowerCase()] ?? name.toLowerCase();
  if (agent.channels && key in agent.channels) return key;
  return die(
    `agent ${JSON.stringify(agent.id)} has no channel ${JSON.stringify(name)}; declared: ${Object.keys(agent.channels ?? {}).join(", ")}`,
  );
}

/**
 * Execution order, from agent.yaml. The skill walks whatever this returns.
 *
 * `order:` declares it explicitly; otherwise mapping order is used. This is
 * what keeps the procedure channel-agnostic: a product with LinkedIn only, or
 * with channels this kit has never seen, needs no prompt edit.
 */
export function channelOrder(agent: Agent): Array<{ name: string; kind: string }> {
  const chans = agent.channels ?? {};
  const names = agent.order ?? Object.keys(chans);
  return names.map((n) => {
    if (!(n in chans)) die(`order lists ${JSON.stringify(n)} but channels has no such entry`);
    return { name: n, kind: chans[n]?.kind ?? "comment" };
  });
}

export function targetsFor(agent: Agent, channel: string, d: Date): Record<string, unknown> {
  const name = resolveChannel(agent, channel);
  const kind = agent.channels[name]?.kind ?? "comment";
  return kind === "connect" ? connectTargets(agent, name, d) : commentTargets(agent, name, d);
}

export function renderMessage(agent: Agent, name: string): string {
  const tpl = agent.messages?.[name];
  if (!tpl) return die(`agent.yaml has no messages.${name}`);
  const offer = (agent.offer ?? {}) as Record<string, unknown>;
  const promo = (offer.promo ?? {}) as Record<string, unknown>;
  const products = (offer.products ?? []) as Array<{ price?: number }>;
  const prices = products.map((p) => Number(p.price ?? 0));
  if (!prices.length) prices.push(0);

  // Every scalar key under `offer:` becomes a placeholder, so a product can add
  // its own fields (a cost comparison, an add-on, a guarantee) and use them in
  // a message without touching this file. Derived and promo keys layer on top.
  const subs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(offer)) {
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") subs[k] = v;
  }
  subs.min_price = Math.min(...prices);
  subs.max_price = Math.max(...prices);
  subs.promo_label = promo.label ?? "";
  subs.promo_price = promo.price ?? "";
  subs.promo_seats = promo.seats_per_week ?? "";

  // Guard the stale-promo hazard, but only for templates that actually quote
  // the promo. A product with no promo at all is valid, and an unconditional
  // check would refuse to render its message.
  const promoKeys = ["promo_label", "promo_price", "promo_seats"];
  if (promoKeys.some((k) => tpl.includes(`{{${k}}}`)) && !promo.active) {
    die(
      `messages.${name} quotes the promo but offer.promo.active is false. ` +
        "Update the template and the promo block together, or the bot will keep quoting a price you no longer honour.",
    );
  }

  let text = tpl;
  for (const [k, v] of Object.entries(subs)) text = text.split(`{{${k}}}`).join(String(v));
  if (text.includes("{{") || text.includes("}}")) {
    die(`unsubstituted placeholder left in messages.${name}: ${text}`);
  }
  return text.split(/\s+/).filter(Boolean).join(" ");
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const COMMANDS = ["targets", "message", "channels", "show"] as const;

export function main(argv: string[]): number {
  const { cmd, rest } = splitCommand(argv, COMMANDS);
  const values = parse(rest, {
    agent: { type: "string" },
    date: { type: "string" },
    json: { type: "boolean", default: false },
    channel: { type: "string" },
    name: { type: "string", default: "warmup" },
  });
  const agent = loadAgent(values.agent as string | undefined);
  const d = values.date ? new Date(`${values.date as string}T00:00:00`) : new Date();
  const asJson = Boolean(values.json);

  if (cmd === "targets") {
    if (!values.channel) die("targets needs --channel <name>");
    emit(targetsFor(agent, values.channel as string, d), asJson);
  } else if (cmd === "message") {
    console.log(renderMessage(agent, values.name as string));
  } else if (cmd === "channels") {
    emit(channelOrder(agent), asJson);
  } else {
    const rot = rotation(agent);
    emit(
      {
        id: agent.id,
        label: agent.label ?? "",
        path: agent._path,
        records: stateDir(agent),
        ...(() => {
          const f = brandFiles(agent);
          return { brand: f.brand, voice: f.voice, also_read: f.other };
        })(),
        order: channelOrder(agent).map((c) => `${c.name} (${c.kind})`),
        titles: agent.audience.titles,
        rotate_by: rot.dimension,
        rotation_values: rot.values.length,
        rotation_today: rotationFor(agent, d),
        promo_active: ((agent.offer?.promo ?? {}) as Record<string, unknown>).active,
      },
      asJson,
    );
  }
  return 0;
}

