import { ValidationError } from "../errors";
import type { ExternalAccountId, MessageId } from "../value-objects/ids";

/** One row per fetched remote message -- the dedupe ledger. Recorded in the
 * same batch as the ingested message so a crash between the two cannot
 * double-ingest.
 *
 * `remoteId` is the provider's own identifier for the message (a JMAP
 * `Email` id, or a POP3 `UIDL`), scoped to one account: the same string from
 * two different accounts is not the same message. */
export interface ExternalMessageState {
  readonly accountId: ExternalAccountId;
  readonly remoteId: string;
  readonly messageId: MessageId;
  readonly fetchedAt: string;
}

export interface CreateExternalMessageStateInput {
  readonly accountId: ExternalAccountId;
  readonly remoteId: string;
  readonly messageId: MessageId;
  readonly fetchedAt: string;
}

export function createExternalMessageState(
  input: CreateExternalMessageStateInput,
): ExternalMessageState {
  const remoteId = input.remoteId.trim();
  if (remoteId.length === 0) {
    throw new ValidationError("remoteId must not be empty", "remoteId");
  }
  return {
    accountId: input.accountId,
    remoteId,
    messageId: input.messageId,
    fetchedAt: input.fetchedAt,
  };
}
