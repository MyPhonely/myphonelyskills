#!/usr/bin/env node
/**
 * The outreach agent's bookkeeping, as one command any AI agent can run.
 *
 *   node outreach.ts <command> --agent <folder> [options]     ($OUTREACH_AGENT saves --agent)
 *
 * The agent
 *   show                          the agent: files to read, records, today's rotation
 *   channels                      the channels in run order, with their kind
 *   targets --channel <c>         today's searches for a channel
 *   message --name warmup         a message rendered from agent.yaml's offer
 *   init                          create the records (idempotent)
 *
 * The rules around every write
 *   check   --channel <c> <target>                       done before?
 *   budget  --channel <c> [--action invite|message|comment]
 *   reserve --channel <c> [--action ...] <target>        permission for one write
 *   record  --reservation <id> --outcome sent|failed <target> [--comment ... --keyword ... --note ...]
 *   release --reservation <id>                           reserved, nothing written
 *   report                                               today, per channel
 *
 * The records directly
 *   quota                         LinkedIn invite room (week and day)
 *   ledger <command> ...          the ledgers: add-lead, list-people, accept, set-stage, ...
 *
 * A <target> is --name "<person>", or --author "<name or @handle>" --title
 * "<title or first words>" [--url <post url>] for a post.
 *
 * Exit status: 0 ok. `check`: 0 when the records already have the target, 1
 * when they do not. `reserve`: 3 refused (already done or tried), 4 refused
 * (budget spent). 2 a usage error.
 */

import { cli, die, emit, loadAgent, parse, setCurrentAgent } from "./lib/common.ts";
import type { Options } from "./lib/common.ts";
import { init, main as ledgerMain } from "./lib/ledger.ts";
import { main as planMain, resolveChannel } from "./lib/plan.ts";
import { main as quotaMain } from "./lib/quota.ts";
import { actionFor, budget, check, record, release, report, reserve } from "./lib/session.ts";

const TARGET: Options = {
  name: { type: "string" },
  author: { type: "string" },
  title: { type: "string" },
  url: { type: "string" },
};

const COMMON: Options = {
  agent: { type: "string" },
  json: { type: "boolean", default: false },
};

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

function target(v: Record<string, unknown>) {
  return { name: str(v.name), author: str(v.author), title: str(v.title), url: str(v.url) };
}

function main(argv: string[]): number | Promise<number> {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "show":
    case "channels":
    case "targets":
    case "message":
      return planMain([cmd, ...rest]);
    case "quota":
      return quotaMain(rest);
    case "ledger":
      return ledgerMain(rest);
    case "init": {
      const v = parse(rest, COMMON);
      setCurrentAgent(loadAgent(str(v.agent)));
      return init(Boolean(v.json));
    }
    case "check": {
      const v = parse(rest, { ...COMMON, ...TARGET, channel: { type: "string" }, action: { type: "string" } });
      const agent = loadAgent(str(v.agent));
      setCurrentAgent(agent);
      if (!v.channel) die("check needs --channel");
      const channel = resolveChannel(agent, v.channel as string);
      const r = check(agent, channel, actionFor(agent, channel, str(v.action)), target(v));
      emit({ channel, found: r.found, skip: r.blocking, rows: r.rows }, Boolean(v.json));
      return r.found ? 0 : 1;
    }
    case "budget": {
      const v = parse(rest, { ...COMMON, channel: { type: "string" }, action: { type: "string" } });
      const agent = loadAgent(str(v.agent));
      setCurrentAgent(agent);
      if (!v.channel) die("budget needs --channel");
      const channel = resolveChannel(agent, v.channel as string);
      emit(budget(agent, channel, actionFor(agent, channel, str(v.action))), Boolean(v.json));
      return 0;
    }
    case "reserve": {
      const v = parse(rest, { ...COMMON, ...TARGET, channel: { type: "string" }, action: { type: "string" } });
      const agent = loadAgent(str(v.agent));
      setCurrentAgent(agent);
      if (!v.channel) die("reserve needs --channel");
      const { reservation, left } = reserve(agent, v.channel as string, str(v.action), target(v));
      emit({ reserved: reservation.id, channel: reservation.channel, action: reservation.action, target: reservation.label, left_after: left }, Boolean(v.json));
      return 0;
    }
    case "record": {
      const v = parse(rest, {
        ...COMMON,
        ...TARGET,
        reservation: { type: "string" },
        outcome: { type: "string" },
        comment: { type: "string" },
        keyword: { type: "string" },
        note: { type: "string" },
      });
      const agent = loadAgent(str(v.agent));
      setCurrentAgent(agent);
      if (!v.reservation || !v.outcome) die("record needs --reservation and --outcome");
      const r = record(agent, {
        reservation: v.reservation as string,
        outcome: v.outcome as string,
        target: target(v),
        comment: str(v.comment),
        keyword: str(v.keyword),
        note: str(v.note),
      });
      emit({ recorded: r.id, outcome: r.state, channel: r.channel, target: r.label }, Boolean(v.json));
      return 0;
    }
    case "release": {
      const v = parse(rest, { ...COMMON, reservation: { type: "string" } });
      setCurrentAgent(loadAgent(str(v.agent)));
      if (!v.reservation) die("release needs --reservation");
      const r = release(v.reservation as string);
      emit({ released: r.id, target: r.label }, Boolean(v.json));
      return 0;
    }
    case "report": {
      const v = parse(rest, { ...COMMON, date: { type: "string" } });
      const agent = loadAgent(str(v.agent));
      setCurrentAgent(agent);
      emit(report(agent, str(v.date)), Boolean(v.json));
      return 0;
    }
    default:
      return die(
        `expected a command: show, channels, targets, message, init, check, budget, reserve, record, release, report, quota, ledger${cmd ? ` (got ${cmd})` : ""}`,
      );
  }
}

if (import.meta.filename === process.argv[1]) cli(main);
