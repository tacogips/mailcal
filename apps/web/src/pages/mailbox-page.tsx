import { useNavigate, useSearchParams } from "@solidjs/router";
import { createEffect, createSignal, type JSX, on, Show } from "solid-js";
import { MESSAGE_QUERY } from "../api/documents";
import { graphqlRequest } from "../api/graphql-client";
import type {
  MessageDetailView,
  MessageView,
  SendMessageVariables,
} from "../api/schema-types";
import { AppShell } from "../components/app-shell";
import {
  type ComposeContent,
  type ComposeDraft,
  ComposeForm,
} from "../components/compose-form";
import { MailboxSidebar } from "../components/mailbox-sidebar";
import { MessageList } from "../components/message-list";
import { MessageView as MessageDetail } from "../components/message-view";
import { Topbar } from "../components/topbar";
import { buildReplyRecipients } from "../lib/address-format";
import {
  type MailboxView,
  searchParamsToView,
  viewTitle,
  viewToSearchParams,
} from "../lib/filter-params";
import { describeErrors } from "../lib/mutation-error";
import { quoteBody, replySubject } from "../lib/quote-reply";
import { pushToast } from "../lib/toast";
import { useStore } from "../store/store-context";
import "./mailbox-page.css";

const EMPTY_DRAFT: ComposeDraft = {
  from: "",
  to: "",
  cc: "",
  subject: "",
  text: "",
};

export default function MailboxPage(): JSX.Element {
  const store = useStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [active, setActive] = createSignal<MessageDetailView | null>(null);
  const [draft, setDraft] = createSignal<ComposeDraft | null>(null);

  // The URL is the source of truth for which mailbox is shown, so a
  // bookmark or a reload lands on the same view.
  createEffect(
    on(
      () =>
        new URLSearchParams(searchParams as Record<string, string>).toString(),
      () => {
        const view = searchParamsToView(
          new URLSearchParams(searchParams as Record<string, string>),
        );
        void store.setView(view);
      },
    ),
  );

  function selectView(view: MailboxView): void {
    setActive(null);
    setSearchParams(Object.fromEntries(viewToSearchParams(view)));
  }

  async function openMessage(message: MessageView): Promise<void> {
    return openMessageById(message.id);
  }

  async function openMessageById(messageId: string): Promise<void> {
    const result = await graphqlRequest<
      { readonly message: MessageDetailView | null },
      Record<string, unknown>
    >(MESSAGE_QUERY, { id: messageId });
    if (!result.ok) {
      pushToast("error", describeErrors(result.errors));
      return;
    }
    if (result.data.message === null) {
      pushToast("error", "That message is no longer available");
      await store.reloadMessages();
      return;
    }
    if (result.data.message.status === "DRAFT") {
      const detail = result.data.message;
      const joined = (kind: string): string =>
        detail.recipients
          .filter((recipient) => recipient.kind === kind)
          .map((recipient) => recipient.address)
          .join(", ");
      setActive(null);
      setDraft({
        draftId: detail.id,
        from: detail.from.address,
        to: joined("TO"),
        cc: joined("CC"),
        subject: detail.subject,
        text: detail.textBody ?? "",
      });
      return;
    }
    setActive(result.data.message);
    setDraft(null);
    if (result.data.message.readAt === null) {
      // Opening a message marks it read, matching every mail client; the
      // list is refreshed by the store so the unread styling clears.
      store.clearSelection();
      store.toggleSelection(messageId);
      await store.markSelectedRead(true);
      store.clearSelection();
    }
  }

  function startCompose(): void {
    const sender = store.viewer()?.sendableAddresses[0] ?? "";
    setActive(null);
    setDraft({ ...EMPTY_DRAFT, from: sender });
  }

  function startReply(replyAll: boolean): void {
    const message = active();
    if (message === null) {
      return;
    }
    const viewer = store.viewer();
    const envelope = message.recipients.find(
      (recipient) => recipient.kind === "ENVELOPE",
    );
    const self = envelope?.address ?? viewer?.sendableAddresses[0] ?? null;
    const { to, cc } = buildReplyRecipients({
      from: message.from,
      recipients: message.recipients,
      replyAll,
      selfAddress: self,
    });
    setDraft({
      from: self ?? viewer?.sendableAddresses[0] ?? "",
      to: to.join(", "),
      cc: cc.join(", "),
      subject: replySubject(message.subject),
      text: quoteBody(message),
      inReplyToMessageId: message.id,
    });
  }

  async function send(input: SendMessageVariables): Promise<boolean> {
    const sent = await store.send(input);
    if (sent) {
      await store.reloadMessages();
    }
    return sent;
  }

  async function saveDraft(content: ComposeContent): Promise<string | null> {
    const saved = await store.saveDraft({
      from: content.from,
      to: content.to,
      cc: content.cc,
      subject: content.subject,
      text: content.text,
      ...(content.draftId === undefined ? {} : { draftId: content.draftId }),
      ...(content.inReplyToMessageId === undefined
        ? {}
        : { inReplyToMessageId: content.inReplyToMessageId }),
      ...(content.attachmentIds.length > 0
        ? { attachmentIds: content.attachmentIds }
        : {}),
    });
    if (saved !== null) {
      await store.reloadMessages();
    }
    return saved?.id ?? null;
  }

  /** Send for a stored draft: persist the latest edits first, then
   * dispatch, so what goes out is what is on screen. */
  async function sendDraft(content: ComposeContent): Promise<boolean> {
    const savedId = await saveDraft(content);
    if (savedId === null) {
      return false;
    }
    const sent = await store.sendDraft(savedId);
    if (sent) {
      await store.reloadMessages();
    }
    return sent;
  }

  async function deleteActive(): Promise<void> {
    const message = active();
    if (message === null) {
      return;
    }
    store.clearSelection();
    store.toggleSelection(message.id);
    await store.deleteSelected();
    setActive(null);
  }

  async function markActiveNotSpam(): Promise<void> {
    const message = active();
    if (message === null) {
      return;
    }
    store.clearSelection();
    store.toggleSelection(message.id);
    await store.markSelectedSpam(false);
    store.clearSelection();
    setActive({ ...message, isSpam: false });
  }

  return (
    <AppShell
      topbar={
        <Topbar
          viewer={store.viewer()}
          title={viewTitle(store.view())}
          totalCount={store.totalCount()}
          selectedCount={store.selectedIds().size}
          onSearch={(query) =>
            selectView(
              query.trim().length === 0
                ? { kind: "INBOX" }
                : { kind: "SEARCH", query: query.trim() },
            )
          }
          onRefresh={() => void store.reloadMessages()}
          onMarkRead={(read) => void store.markSelectedRead(read)}
          onMarkSpam={(spam) => void store.markSelectedSpam(spam)}
          onDelete={() => void store.deleteSelected()}
          onLogout={() => {
            void store.logout().finally(() => navigate("/login"));
          }}
        />
      }
      sidebar={
        <MailboxSidebar
          current={store.view()}
          domains={store.domains()}
          tags={store.tags()}
          upcomingEvents={store.upcomingEvents()}
          onSelect={selectView}
          onOpenEvent={(messageId) => void openMessageById(messageId)}
          onCompose={startCompose}
        />
      }
    >
      <MessageList
        messages={store.messages()}
        selectedIds={store.selectedIds()}
        activeId={active()?.id ?? null}
        loading={store.loading()}
        hasMore={store.hasMore()}
        onOpen={(message) => void openMessage(message)}
        onToggleSelect={(id) => store.toggleSelection(id)}
        onLoadMore={() => void store.loadMore()}
      />

      <Show
        when={draft() !== null}
        fallback={
          <Show
            when={active() !== null}
            fallback={
              <p class="empty">Select a message, or compose a new one.</p>
            }
          >
            <MessageDetail
              message={active() as MessageDetailView}
              onReply={startReply}
              onNotSpam={() => void markActiveNotSpam()}
              onDelete={() => void deleteActive()}
            />
          </Show>
        }
      >
        <ComposeForm
          draft={draft() as ComposeDraft}
          sendableAddresses={store.viewer()?.sendableAddresses ?? []}
          onCancel={() => setDraft(null)}
          onSend={send}
          onSaveDraft={saveDraft}
          onSendDraft={sendDraft}
        />
      </Show>
    </AppShell>
  );
}
