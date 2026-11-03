/**
 * The phone phases for the three steps a run kept getting wrong.
 *
 *   outreach.ts phases --flow warmup --name "<person>" --text "<message>"
 *   outreach.ts phases --flow xhs-follow --name "<nickname>"
 *
 * The goals are the operator's instructions. They are data, so a test can
 * lock the words that stop the failure: an invitation note is not a reply,
 * Send is one tap after the text is verified, a missed warmup clears the
 * composer, and a Xiaohongshu follow targets the header button and checks
 * that it changed.
 */

import { die } from "./common.ts";

/** Labels that mean the header button was tapped and the follow took. */
export const XHS_FOLLOWING = "Following|Friends|已关注|互相关注";

/**
 * The header Follow control, and not "Following" or the stats line.
 * `+ 关注` and `关注按钮` are how some builds name the same pill.
 */
export const XHS_FOLLOW_BUTTON = "^(关注(按钮)?|[+＋]\\s*关注|Follow( button)?)$";

export interface PhaseCall {
  allow_writes?: boolean;
  phases: Array<Record<string, unknown>>;
}

export interface ResumeCall {
  allowWrites: boolean;
  repeat: number;
  countLabel: string;
  goal: string;
  maxSteps: number;
}

/** Type the warmup and stop with Send on screen. Nothing is sent. */
export function warmupType(person: string, message: string): PhaseCall {
  return {
    allow_writes: true,
    phases: [
      {
        launch: "com.linkedin.android",
        goal: warmupTypeGoal(person),
        allowWrites: true,
        typeTexts: [message],
        findTexts: [person],
        pauseWhen: warmupPause(person),
        maxSteps: 22,
      },
    ],
  };
}

/** Tap Send once, then confirm the bubble. No second tap. */
export function warmupSend(person: string): ResumeCall {
  return {
    allowWrites: true,
    repeat: 1,
    countLabel: "^Send$",
    goal: warmupSendGoal(person),
    maxSteps: 8,
  };
}

/**
 * Drop an unsent draft. Writes stay off so this does not spend another
 * reservation; `phone_clear_text` is the sure way, and this phase is the
 * fallback when that call cannot focus the field.
 */
export function warmupClear(person: string): PhaseCall {
  return {
    phases: [
      {
        goal: warmupClearGoal(person),
        maxSteps: 6,
      },
    ],
  };
}

/** Tap the profile header Follow once, retry that same button once, then stop. */
export function xhsFollow(name: string): PhaseCall {
  return {
    allow_writes: true,
    phases: [
      {
        allowWrites: true,
        repeat: 1,
        countLabel: XHS_FOLLOW_BUTTON,
        require: { label: XHS_FOLLOW_BUTTON },
        goal: xhsFollowGoal(name),
        pauseWhen: `the profile of ${name} is open and the red header button beside the nickname reads Follow or 关注, and it has not been tapped yet`,
        maxSteps: 8,
      },
    ],
  };
}

export function warmupTypeGoal(person: string): string {
  return [
    `Open the LinkedIn message composer for ${person} and type the supplied message once.`,
    "Tap My Network, then Manage my network, then Connections.",
    `Find ${person} and tap Message or Send a message on that card.`,
    "The screen is right if it is the conversation (a Write a message field; Name this chat is only a label, leave it alone) or a New message sheet that already names them and shows Send.",
    "Do not leave a composer that is already open, and do not start a second one.",
    "Read the thread before typing.",
    "The invitation note on the connection request is not a reply and not a past message from us: a connection-request banner, or the note text we attached when we invited them, does not count.",
    "Type nothing only when a chat bubble from us, sent after they accepted, is already in the thread.",
    "Otherwise focus Write a message, or the field on the New message sheet, and type the supplied message once.",
    "Do not type it twice. Do not tap Send. Do not press Enter, which inserts a line.",
    "Leave the text in the field.",
  ].join(" ");
}

export function warmupPause(person: string): string {
  return `the composer for ${person} shows the full supplied message and a Send button, and the message has not been sent, on either the thread's Write a message field or the New message sheet`;
}

export function warmupSendGoal(person: string): string {
  return [
    `The message to ${person} is already in the composer. Read it and confirm it is the supplied message.`,
    "Tap Send once.",
    "Do not type, do not press Enter, do not scroll, do not press back, and do not tap Name this chat.",
    "Then confirm that text appears as a sent bubble and the input is empty.",
    "If no sent bubble appears, stop without tapping Send again.",
  ].join(" ");
}

export function warmupClearGoal(person: string): string {
  return [
    `An unsent draft for ${person} is in the LinkedIn composer (the thread field or a New message sheet).`,
    "Delete every character so the field is empty.",
    "Do not tap Send and do not press Enter.",
    "On a New message sheet, clear the field and close the sheet without sending.",
    "Stop when no draft text remains.",
  ].join(" ");
}

export function xhsFollowGoal(name: string): string {
  return [
    `The Xiaohongshu profile of ${name} is already open.`,
    "Tap the red header button beside the nickname. Its label is exactly Follow, Follow button, 关注, 关注按钮, or + 关注.",
    "That button sits in the profile header, above the notes grid.",
    "Do not tap the stats line (a number followed by Following or 关注), the bottom tab bar, a note, or a Follow on any other person.",
    "Do not follow the author of the source note. Do not like the source note. Do not comment, reply, or send a message.",
    "If the screen says 操作太频繁 or 请稍后再试, tap nothing and stop.",
    "After the tap, read that same header button.",
    `The follow took only when it reads ${XHS_FOLLOWING.split("|").join(", ")}.`,
    "If it still reads Follow or 关注, tap that same header button once more and read it again.",
    "Then stop. Do not tap a third time.",
  ].join(" ");
}

export function phasesFor(flow: string, name: string, text?: string): Record<string, unknown> {
  const person = name.trim();
  if (!person) die("phases needs --name");
  if (flow === "warmup") {
    const message = (text ?? "").trim();
    if (!message) die("phases --flow warmup needs --text, the approved message");
    return {
      flow: "warmup",
      note: "Type and pause, show the text, then resume with send. If Send is not verified, phone_clear_text (or clear) and record the message failed so the ledger marks warmup retry. The invitation note is not a reply.",
      type: warmupType(person, message),
      send: warmupSend(person),
      clear: warmupClear(person),
    };
  }
  if (flow === "xhs-follow") {
    return {
      flow: "xhs-follow",
      note: "Resume this paused task to tap. Record a follow only when the header button reads Following, Friends, 已关注, or 互相关注. One extra tap if it does not change, then release and reserve once more. Stop Xiaohongshu for the day on 操作太频繁.",
      follow: xhsFollow(person),
    };
  }
  return die("phases --flow must be warmup or xhs-follow");
}
