import { createSignal, type JSX, Show } from "solid-js";
import type { ViewerView } from "../api/schema-types";
import "./topbar.css";

export function Topbar(props: {
  readonly viewer: ViewerView | null;
  readonly title: string;
  readonly totalCount: number;
  readonly selectedCount: number;
  readonly onSearch: (query: string) => void;
  readonly onRefresh: () => void;
  readonly onMarkRead: (read: boolean) => void;
  readonly onMarkSpam: (spam: boolean) => void;
  readonly onDelete: () => void;
  readonly onLogout: () => void;
}): JSX.Element {
  const [query, setQuery] = createSignal("");
  const isAdmin = () => props.viewer?.user?.role === "ADMIN";

  return (
    <header class="topbar">
      <div class="topbar-title">
        <strong>{props.title}</strong>
        <span class="muted"> ({props.totalCount})</span>
      </div>

      <form
        class="topbar-search"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearch(query());
        }}
      >
        <input
          type="search"
          aria-label="Search mail"
          placeholder={
            "Search... (from: to: cc: has:attachment kind:pdf tag:name is:unread)"
          }
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      </form>

      <div class="topbar-actions">
        <Show when={props.selectedCount > 0}>
          <span class="muted">{props.selectedCount} selected</span>
          <button type="button" onClick={() => props.onMarkRead(true)}>
            Read
          </button>
          <button type="button" onClick={() => props.onMarkRead(false)}>
            Unread
          </button>
          <button type="button" onClick={() => props.onMarkSpam(true)}>
            Spam
          </button>
          <button type="button" onClick={() => props.onMarkSpam(false)}>
            Not spam
          </button>
          <button type="button" class="danger" onClick={() => props.onDelete()}>
            Delete
          </button>
        </Show>
        <button type="button" onClick={() => props.onRefresh()}>
          Refresh
        </button>
        <Show when={isAdmin()}>
          <a href="/settings/domains">Domains</a>
          <a href="/settings/api-keys">API keys</a>
          <a href="/settings/rules">Rules</a>
        </Show>
        <a href="/settings/tags">Tags</a>
        <Show when={props.viewer?.user !== null && props.viewer !== null}>
          <button type="button" onClick={() => props.onLogout()}>
            Sign out
          </button>
        </Show>
      </div>
    </header>
  );
}
