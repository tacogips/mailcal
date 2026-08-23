import { createSignal, For, type JSX, Show } from "solid-js";
import { CREATE_RAW_MESSAGE_LINK_MUTATION } from "../api/documents";
import { graphqlRequest } from "../api/graphql-client";
import type {
  CreatedFileLinkView,
  MessageDetailView,
} from "../api/schema-types";
import { formatMailbox, formatRecipients } from "../lib/address-format";
import { describeErrors } from "../lib/mutation-error";
import { formatAbsoluteTime, formatBytes } from "../lib/relative-time";
import { pushToast } from "../lib/toast";
import { AttachmentTile } from "./attachment-tile";
import { EventPanel } from "./event-panel";
import { HtmlBodyFrame } from "./html-body-frame";
import { SpamBanner } from "./spam-banner";
import { TagChip } from "./tag-chip";
import "./message-view.css";

export function MessageView(props: {
  readonly message: MessageDetailView;
  readonly onReply: (replyAll: boolean) => void;
  readonly onNotSpam: () => void;
  readonly onDelete: () => void;
}): JSX.Element {
  const [rawLink, setRawLink] = createSignal<string | null>(null);

  async function mintRawLink(): Promise<void> {
    const result = await graphqlRequest<
      { readonly createRawMessageLink: CreatedFileLinkView },
      Record<string, unknown>
    >(CREATE_RAW_MESSAGE_LINK_MUTATION, {
      messageId: props.message.id,
      ttlSeconds: 3600,
    });
    if (!result.ok) {
      pushToast("error", describeErrors(result.errors));
      return;
    }
    setRawLink(result.data.createRawMessageLink.url);
    pushToast("success", "Temporary link to the raw message created");
  }

  const toRecipients = () =>
    props.message.recipients.filter(
      (recipient) => recipient.kind === "TO" || recipient.kind === "ENVELOPE",
    );
  const ccRecipients = () =>
    props.message.recipients.filter((recipient) => recipient.kind === "CC");

  return (
    <article class="message-view">
      <Show when={props.message.isSpam}>
        <SpamBanner message={props.message} onNotSpam={props.onNotSpam} />
      </Show>

      <header class="message-view-header">
        <h1 class="message-view-subject">
          {props.message.subject.length === 0
            ? "(no subject)"
            : props.message.subject}
        </h1>
        <dl class="message-view-fields">
          <dt>From</dt>
          <dd>{formatMailbox(props.message.from)}</dd>
          <dt>To</dt>
          <dd>{formatRecipients(toRecipients())}</dd>
          <Show when={ccRecipients().length > 0}>
            <dt>Cc</dt>
            <dd>{formatRecipients(ccRecipients())}</dd>
          </Show>
          <dt>Date</dt>
          <dd>{formatAbsoluteTime(props.message.occurredAt)}</dd>
          <Show when={props.message.deliveryStatus === "FAILED"}>
            <dt>Delivery</dt>
            <dd class="error-text">
              Failed
              {props.message.deliveryError === null
                ? ""
                : ` (${props.message.deliveryError})`}
            </dd>
          </Show>
        </dl>

        <Show when={props.message.isMailingList}>
          <p class="muted">
            This message is from a mailing list
            {props.message.listId === null ? "" : ` (${props.message.listId})`}.
          </p>
        </Show>

        <Show when={props.message.tags.length > 0}>
          <div class="message-view-tags">
            <For each={props.message.tags}>
              {(tag) => <TagChip tag={tag} />}
            </For>
          </div>
        </Show>

        <div class="message-view-actions">
          <button type="button" onClick={() => props.onReply(false)}>
            Reply
          </button>
          <button type="button" onClick={() => props.onReply(true)}>
            Reply all
          </button>
          <button type="button" onClick={() => void mintRawLink()}>
            Temp link to raw ({formatBytes(props.message.rawSize)})
          </button>
          <button type="button" class="danger" onClick={() => props.onDelete()}>
            Delete
          </button>
        </div>
        <Show when={rawLink() !== null}>
          <code class="message-view-rawlink">{rawLink()}</code>
        </Show>
      </header>

      <EventPanel
        messageId={props.message.id}
        initialEvents={props.message.events}
      />

      <Show when={props.message.bodyTruncated}>
        <p class="muted message-view-truncated">
          This body was truncated for storage. Use the raw message link above
          for the complete original.
        </p>
      </Show>

      <section class="message-view-body">
        <Show
          when={props.message.htmlBody !== null}
          fallback={
            <pre class="message-view-text">
              {props.message.textBody ?? props.message.snippet}
            </pre>
          }
        >
          <HtmlBodyFrame html={props.message.htmlBody ?? ""} />
        </Show>
      </section>

      <Show when={props.message.attachments.length > 0}>
        <section class="message-view-attachments">
          <h2>Attachments</h2>
          <For each={props.message.attachments}>
            {(attachment) => <AttachmentTile attachment={attachment} />}
          </For>
        </section>
      </Show>
    </article>
  );
}
