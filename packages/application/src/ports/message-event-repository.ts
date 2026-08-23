import type { MessageEvent } from "@yabumi/domain/entities/message-event";
import type { AddressPattern } from "@yabumi/domain/value-objects/address-pattern";
import type {
  MessageEventId,
  MessageId,
} from "@yabumi/domain/value-objects/ids";

export interface MessageEventListFilter {
  /** Due on or before this instant. Events with no dueAt never match a
   * due-bounded filter. */
  readonly dueBefore?: string;
  readonly dueAfter?: string;
  readonly includeCompleted?: boolean;
  /** Scope allowlist over the owning message's addresses, with the same
   * semantics as `MessageListFilter.allowedPatterns`. */
  readonly allowedPatterns: readonly AddressPattern[] | null;
}

export interface MessageEventRepository {
  findById(id: MessageEventId): Promise<MessageEvent | null>;
  save(event: MessageEvent): Promise<void>;
  delete(id: MessageEventId): Promise<void>;
  listByMessages(
    ids: readonly MessageId[],
  ): Promise<ReadonlyMap<string, readonly MessageEvent[]>>;
  /** Agenda listing across messages, soonest due first, undated last. */
  list(
    filter: MessageEventListFilter,
    limit: number,
  ): Promise<readonly MessageEvent[]>;
}
