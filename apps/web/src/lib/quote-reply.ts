import type { MessageDetailView } from "../api/schema-types";
import { formatMailbox } from "./address-format";

const REPLY_PREFIX = /^re:\s*/i;
const FORWARD_PREFIX = /^fwd?:\s*/i;

/** Adds a single `Re:` prefix, never stacking them -- a thread that has been
 * replied to five times should still read `Re: Subject`. */
export function replySubject(subject: string): string {
  const trimmed = subject.trim();
  return REPLY_PREFIX.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function forwardSubject(subject: string): string {
  const trimmed = subject.trim();
  return FORWARD_PREFIX.test(trimmed) ? trimmed : `Fwd: ${trimmed}`;
}

/** Quotes a message body in the conventional `>` style.
 *
 * Falls back to the snippet when the message has no plain-text body, rather
 * than quoting raw HTML markup at the reader. */
export function quoteBody(message: MessageDetailView): string {
  const source =
    message.textBody !== null && message.textBody.length > 0
      ? message.textBody
      : message.snippet;
  const attribution = `On ${message.occurredAt}, ${formatMailbox(message.from)} wrote:`;
  const quoted = source
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\n${attribution}\n${quoted}\n`;
}
