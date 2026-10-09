/**
 * Which people-search cards to keep, from the card alone: no profile opened.
 *
 *   outreach.ts cards --pair "<paired school>" < cards.json
 *
 * cards.json is the `collected` list from linkedin-search-people: objects
 * with name, headline and location. Each card is kept or dropped by
 * audience.card_filter:
 *
 *   location       in the United States ("us") or in one of the listed places
 *   headline       names one of headline_any, and none of headline_none once
 *                  "ex-", "prev", "former" and "intern" parts are set aside;
 *                  "PhD student/candidate" or "postdoc" now overrides headline_none
 *   name match     the paired school matched the person's NAME, not their
 *                  education ("Muhammad Sharif Uddin" for Sharif University)
 *
 * Deterministic, so the same cards always give the same answer, and the AI
 * never has to judge a location or a headline itself.
 */

import type { CardFilter } from "./common.ts";

export interface Card {
  name?: string;
  headline?: string;
  location?: string;
  [key: string]: unknown;
}

export interface CardVerdict {
  card: Card;
  keep: boolean;
  /** Why it was dropped; empty when kept. */
  reason: string;
}

const STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida",
  "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
  "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska",
  "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas",
  "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
];

// LinkedIn often shows a metro area with no country: "Greater Seattle Area".
const US_METROS = [
  "Los Angeles", "San Francisco", "Bay Area", "San Diego", "Inland Empire", "Orange County", "Greater Boston",
  "Greater Seattle", "Greater Chicago", "Greater Philadelphia", "Greater Houston", "Dallas-Fort Worth",
  "Atlanta Metropolitan", "Washington DC-Baltimore", "Miami-Fort Lauderdale", "Denver Metropolitan",
  "Greater Phoenix", "Austin, Texas", "Research Triangle", "Raleigh-Durham", "Pittsburgh", "Detroit Metropolitan",
  "Minneapolis-St. Paul", "Salt Lake City", "Portland, Oregon", "New York City Metropolitan", "Ann Arbor",
  "Champaign", "West Lafayette", "Madison, Wisconsin", "Sacramento", "Silicon Valley",
];

// Places that contain a US name but are not in the US.
const NOT_US = [/new south wales/i, /\bwashington,? (?:tyne|england)/i, /georgia(?:,| \()?\s*(?:tbilisi|country)/i, /\bbirmingham,? (?:england|united kingdom)/i];

export function inUS(location: string): boolean {
  const l = location.trim();
  if (!l) return false;
  if (NOT_US.some((re) => re.test(l))) return false;
  if (/united states|\bUSA\b|\bU\.S\./i.test(l)) return true;
  const lower = l.toLowerCase();
  if (STATES.some((s) => new RegExp(`(^|, |\\s)${s.toLowerCase()}(,|$|\\s)`).test(lower))) return true;
  return US_METROS.some((m) => lower.includes(m.toLowerCase()));
}

/** Lowercased, with "Ph.D." as "phd" and "@" spaced, so terms match however the headline writes them. */
function norm(text: string): string {
  return ` ${text.toLowerCase().replace(/ph\.?\s?d\.?/g, "phd").replace(/@/g, " @ ").replace(/\s+/g, " ")} `;
}

/** The headline without its past and side parts: "ex-Meta", "Prev. Intern @Google". */
function currentPart(headline: string): string {
  return headline
    .split(/[|•·;,]| - /)
    .filter((part) => !/\b(ex[- ]|prev\b|prev\.|previously|former|formerly|intern|internship|alum|alumnus|alumna)\b/i.test(part))
    .join(" | ");
}

// Says outright that they are a doctoral student or postdoc now: kept even if
// another part names a job ("Civil Engineer | Ph.D. Student @Purdue").
const NOW_STUDYING = /\bphd (student|candidate)\b|\bdoctoral (student|candidate|researcher)\b|\bpost-?doc|\bpostdoctoral\b/;

const STOP = new Set(["university", "institute", "technology", "national", "college", "school", "the", "and", "for", "state"]);

/** Did the paired school match the person's name rather than their profile? */
function nameMatch(card: Card, pair: string): boolean {
  const tokens = pair
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));
  const name = (card.name ?? "").toLowerCase();
  const headline = (card.headline ?? "").toLowerCase();
  return tokens.some((t) => new RegExp(`\\b${t}\\b`).test(name) && !headline.includes(t));
}

export function judgeCard(card: Card, filter: CardFilter, pair?: string): CardVerdict {
  const location = String(card.location ?? "");
  const loc = filter.location;
  if (loc === "us") {
    if (!inUS(location)) return { card, keep: false, reason: `not in the US (${location || "no location"})` };
  } else if (Array.isArray(loc) && loc.length) {
    const lower = location.toLowerCase();
    if (!loc.some((p) => lower.includes(p.toLowerCase()))) return { card, keep: false, reason: `not in ${loc.join(" / ")} (${location || "no location"})` };
  }
  const headline = String(card.headline ?? "");
  const now = norm(currentPart(headline));
  const any = (filter.headline_any ?? []).map(norm);
  if (any.length && !any.some((t) => now.includes(t.trim()))) {
    return { card, keep: false, reason: `headline is not a current one of: ${(filter.headline_any ?? []).join(", ")}` };
  }
  const none = NOW_STUDYING.test(now) ? undefined : (filter.headline_none ?? []).find((t) => now.includes(norm(t).trim()));
  if (none) return { card, keep: false, reason: `headline says "${none}"` };
  if (pair && nameMatch(card, pair)) return { card, keep: false, reason: `"${pair}" matched the name, not the profile` };
  return { card, keep: true, reason: "" };
}

export function judgeCards(cards: Card[], filter: CardFilter, pair?: string): CardVerdict[] {
  return cards.map((c) => judgeCard(c, filter, pair));
}
