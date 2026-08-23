import { For, type JSX, Show } from "solid-js";
import type {
  MailDomainView,
  MessageEventView,
  TagView,
} from "../api/schema-types";
import type { MailboxView } from "../lib/filter-params";
import "./mailbox-sidebar.css";

const SYSTEM_VIEWS: readonly {
  readonly view: MailboxView;
  readonly label: string;
}[] = [
  { view: { kind: "INBOX" }, label: "Inbox" },
  { view: { kind: "STARRED" }, label: "Starred" },
  { view: { kind: "SENT" }, label: "Sent" },
  { view: { kind: "DRAFTS" }, label: "Drafts" },
  { view: { kind: "ARCHIVED" }, label: "Archived" },
  { view: { kind: "SPAM" }, label: "Spam" },
  { view: { kind: "TRASH" }, label: "Trash" },
];

function sameView(a: MailboxView, b: MailboxView): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === "TAG" && b.kind === "TAG") {
    return a.tagId === b.tagId;
  }
  if (a.kind === "ADDRESS" && b.kind === "ADDRESS") {
    return a.address === b.address;
  }
  return true;
}

function dueLabel(value: string | null): string {
  if (value === null) {
    return "";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MailboxSidebar(props: {
  readonly current: MailboxView;
  readonly domains: readonly MailDomainView[];
  readonly tags: readonly TagView[];
  readonly upcomingEvents: readonly MessageEventView[];
  readonly onSelect: (view: MailboxView) => void;
  readonly onCompose: () => void;
  readonly onOpenEvent: (messageId: string) => void;
}): JSX.Element {
  // System tags already have dedicated views above, so listing them again
  // under "Tags" would be a confusing duplicate.
  const userTags = () => props.tags.filter((tag) => tag.kind === "USER");

  return (
    <nav class="mailbox-sidebar">
      <button
        type="button"
        class="primary sidebar-compose"
        onClick={() => props.onCompose()}
      >
        Compose
      </button>

      <ul class="sidebar-group">
        <For each={SYSTEM_VIEWS}>
          {(entry) => (
            <li>
              <button
                type="button"
                classList={{
                  "sidebar-item": true,
                  "sidebar-item-active": sameView(props.current, entry.view),
                }}
                onClick={() => props.onSelect(entry.view)}
              >
                {entry.label}
              </button>
            </li>
          )}
        </For>
      </ul>

      <Show when={props.upcomingEvents.length > 0}>
        <h2 class="sidebar-heading">Upcoming</h2>
        <ul class="sidebar-group">
          <For each={props.upcomingEvents}>
            {(event) => (
              <li>
                <button
                  type="button"
                  class="sidebar-item sidebar-event"
                  title={event.message?.subject ?? event.title}
                  onClick={() => props.onOpenEvent(event.messageId)}
                >
                  <span class="sidebar-event-due">{dueLabel(event.dueAt)}</span>
                  <span class="sidebar-event-title">{event.title}</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={props.domains.length > 0}>
        <h2 class="sidebar-heading">Domains</h2>
        <ul class="sidebar-group">
          <For each={props.domains}>
            {(domain) => (
              <li>
                <span class="sidebar-static">
                  {domain.name}
                  <span class="muted"> ({domain.messageCount})</span>
                </span>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={userTags().length > 0}>
        <h2 class="sidebar-heading">Tags</h2>
        <ul class="sidebar-group">
          <For each={userTags()}>
            {(tag) => (
              <li>
                <button
                  type="button"
                  classList={{
                    "sidebar-item": true,
                    "sidebar-item-active": sameView(props.current, {
                      kind: "TAG",
                      tagId: tag.id,
                      name: tag.name,
                    }),
                  }}
                  onClick={() =>
                    props.onSelect({
                      kind: "TAG",
                      tagId: tag.id,
                      name: tag.name,
                    })
                  }
                >
                  {tag.name}
                  <span class="muted"> ({tag.messageCount})</span>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </nav>
  );
}
