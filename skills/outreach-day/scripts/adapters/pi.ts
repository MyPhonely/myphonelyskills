/**
 * pi extension: the outreach-day rules enforced on every MyPhonely call.
 *
 *     export OUTREACH_AGENT=<agent folder> MYPHONELY_API_KEY=...
 *     pi -e <skill>/scripts/adapters/pi.ts --skill <myphonelyskills>/skills \
 *        "Run outreach-day for $OUTREACH_AGENT"
 *
 * It does two things the skill's instructions alone cannot:
 *
 *   - connects MyPhonely with the direct tools that can write hidden, so the
 *     model never sees a way to write outside run_task;
 *   - checks every MyPhonely call with the same guard as the Claude Code hook
 *     (lib/guard.ts): no write without an open reservation from
 *     `outreach reserve`, a review pause on every writing phase, and the
 *     commit approved by the person. With no one to approve (pi -p) a commit
 *     is refused unless OUTREACH_UNATTENDED=1.
 *
 * The bookkeeping itself stays the skill's shell commands (outreach.ts), so
 * pi needs its bash tool.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadAgent, setCurrentAgent } from "../lib/common.ts";
import { guard } from "../lib/guard.ts";
import { phoneTool, SERVER } from "../lib/policy.ts";

export default function (pi: ExtensionAPI) {
  const key = process.env.MYPHONELY_API_KEY ?? "";
  if (key) {
    pi.registerMcpServer(SERVER, {
      url: process.env.MYPHONELY_MCP_URL ?? "https://api.myphonely.ai/mcp",
      headers: { Authorization: `Bearer ${key}` },
      description: "The user's real Android phone: run_task for routes in apps, the phone_* tools to look and navigate",
      exposure: "direct",
      toolExposure: {
        phone_type: "hidden",
        phone_clear_text: "hidden",
        phone_tap: "hidden",
        phone_long_press: "hidden",
        phone_swipe: "hidden",
        phone_push_file: "hidden",
        phone_pull_file: "hidden",
      },
      timeout: 120,
    });
  }

  pi.on("tool_call", async (event, ctx) => {
    if (!phoneTool(event.toolName)) return;
    try {
      setCurrentAgent(loadAgent());
    } catch {
      setCurrentAgent(null);
    }
    const unattended = process.env.OUTREACH_UNATTENDED === "1";
    let v;
    try {
      v = guard(event.toolName, (event.input ?? {}) as Record<string, unknown>, unattended);
    } catch (error) {
      return { block: true, reason: `the outreach rules could not be checked: ${(error as Error).message}` };
    }
    if (v.decision === "deny") return { block: true, reason: v.reason };
    if (v.decision === "ask") {
      if (!ctx.hasUI) {
        return {
          block: true,
          reason: "this write needs the person's approval and no one is here to give it; record the draft as failed and move on",
        };
      }
      const ok = await ctx.ui.confirm("Approve this write on the phone?", v.reason);
      if (!ok) {
        return { block: true, reason: "the person declined: abandon the paused task (resume_task abandon), then outreach release" };
      }
    }
    return;
  });
}
