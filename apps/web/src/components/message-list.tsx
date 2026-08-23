import { For, type JSX, Show } from "solid-js";
import type { MessageView } from "../api/schema-types";
import { shortMailbox } from "../lib/address-format";
import { formatRelativeTime } from "../lib/relative-time";
import { TagChip } from "./tag-chip";
import "./message-list.css";

export function MessageList(props: {
  readonly messages: readonly MessageView[];
  readonly selectedIds: ReadonlySet<string>;
  readonly activeId: string | null;
  readonly loading: boolean;
  readonly hasMore: boolean;
  readonly onOpen: (message: MessageView) => void;
  readonly onToggleSelect: (id: string) => void;
  readonly onLoadMore: () => void;
}): JSX.Element {
  const now = new Date();

  return (
    <div class="message-list">
      <Show
        when={props.messages.length > 0 || props.loading}
        fallback={<p class="empty">No messages here.</p>}
      >
        <ul class="message-list-items">
          <For each={props.messages}>
            {(message) => (
              <li
                classList={{
                  "message-row": true,
                  "message-row-unread": message.readAt === null,
                  "message-row-active": props.activeId === message.id,
                }}
              >
                <input
                  type="checkbox"
                  class="message-select"
                  aria-label={`Select ${message.subject}`}
                  checked={props.selectedIds.has(message.id)}
                  onChange={() => props.onToggleSelect(message.id)}
                />
                <button
                  type="button"
                  class="message-open"
                  onClick={() => props.onOpen(message)}
                >
                  <span class="message-line">
                    <span class="message-from">
                      {shortMailbox(message.from)}
                    </span>
                    <span class="message-time muted">
                      {formatRelativeTime(message.occurredAt, now)}
                    </span>
                  </span>
                  <span class="message-subject">
                    {message.subject.length === 0
                      ? "(no subject)"
                      : message.subject}
                  </span>
                  <span class="message-snippet muted">{message.snippet}</span>
                  <Show when={message.tags.length > 0}>
                    <span class="message-tags">
                      <For each={message.tags}>
                        {(tag) => <TagChip tag={tag} />}
                      </For>
                    </span>
                  </Show>
                  <Show when={message.attachments.length > 0}>
                    <span class="message-attachments muted">
                      {message.attachments.length} attachment(s)
                    </span>
                  </Show>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Show when={props.hasMore}>
        <button
          type="button"
          class="message-load-more"
          disabled={props.loading}
          onClick={() => props.onLoadMore()}
        >
          {props.loading ? "Loading..." : "Load more"}
        </button>
      </Show>
    </div>
  );
}
