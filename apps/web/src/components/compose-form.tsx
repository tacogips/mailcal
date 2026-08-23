import { createSignal, For, type JSX, Show } from "solid-js";
import { uploadAttachment } from "../api/graphql-client";
import type { SendMessageVariables } from "../api/schema-types";
import { describeErrors } from "../lib/mutation-error";
import { pushToast } from "../lib/toast";
import "./compose-form.css";

export interface ComposeDraft {
  /** Present when editing a stored draft; Send then dispatches that draft
   * and Save updates it in place. */
  readonly draftId?: string;
  readonly from: string;
  readonly to: string;
  readonly cc: string;
  readonly subject: string;
  readonly text: string;
  readonly inReplyToMessageId?: string;
}

export interface ComposeContent {
  readonly draftId?: string;
  readonly from: string;
  readonly to: readonly string[];
  readonly cc: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly attachmentIds: readonly string[];
}

interface UploadedAttachment {
  readonly id: string;
  readonly fileName: string;
}

function splitAddresses(value: string): readonly string[] {
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function ComposeForm(props: {
  readonly draft: ComposeDraft;
  /** From the viewer's MAIL_SEND scopes, so the picker cannot offer a
   * sender the server will reject. */
  readonly sendableAddresses: readonly string[];
  readonly onCancel: () => void;
  readonly onSend: (input: SendMessageVariables) => Promise<boolean>;
  /** Saves the current content as a draft. Returns the draft id so later
   * saves in the same session update rather than duplicate. */
  readonly onSaveDraft?: (content: ComposeContent) => Promise<string | null>;
  /** Dispatches a stored draft after saving the latest edits. */
  readonly onSendDraft?: (content: ComposeContent) => Promise<boolean>;
}): JSX.Element {
  const [from, setFrom] = createSignal(props.draft.from);
  const [to, setTo] = createSignal(props.draft.to);
  const [cc, setCc] = createSignal(props.draft.cc);
  const [subject, setSubject] = createSignal(props.draft.subject);
  const [text, setText] = createSignal(props.draft.text);
  const [attachments, setAttachments] = createSignal<
    readonly UploadedAttachment[]
  >([]);
  const [sending, setSending] = createSignal(false);
  const [uploading, setUploading] = createSignal(false);
  const [savingDraft, setSavingDraft] = createSignal(false);
  const [draftId, setDraftId] = createSignal<string | null>(
    props.draft.draftId ?? null,
  );

  function currentContent(): ComposeContent {
    const id = draftId();
    return {
      ...(id === null ? {} : { draftId: id }),
      from: from(),
      to: splitAddresses(to()),
      cc: splitAddresses(cc()),
      subject: subject(),
      text: text(),
      attachmentIds: attachments().map((entry) => entry.id),
    };
  }

  async function handleSaveDraft(): Promise<void> {
    if (props.onSaveDraft === undefined) {
      return;
    }
    setSavingDraft(true);
    const savedId = await props.onSaveDraft(currentContent());
    if (savedId !== null) {
      setDraftId(savedId);
    }
    setSavingDraft(false);
  }

  async function handleFiles(files: FileList | null): Promise<void> {
    if (files === null || files.length === 0) {
      return;
    }
    setUploading(true);
    for (const file of Array.from(files)) {
      const result = await uploadAttachment(file);
      if (!result.ok) {
        pushToast("error", describeErrors(result.errors));
        continue;
      }
      setAttachments((current) => [...current, result.data]);
    }
    setUploading(false);
  }

  async function handleSend(event: Event): Promise<void> {
    event.preventDefault();
    const recipients = splitAddresses(to());
    if (recipients.length === 0) {
      pushToast("error", "At least one recipient is required");
      return;
    }
    setSending(true);
    if (draftId() !== null && props.onSendDraft !== undefined) {
      const dispatched = await props.onSendDraft(currentContent());
      setSending(false);
      if (dispatched) {
        props.onCancel();
      }
      return;
    }
    const ccList = splitAddresses(cc());
    const attachmentIds = attachments().map((entry) => entry.id);
    const sent = await props.onSend({
      from: from(),
      to: recipients,
      subject: subject(),
      text: text(),
      ...(ccList.length > 0 ? { cc: ccList } : {}),
      ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
      ...(props.draft.inReplyToMessageId === undefined
        ? {}
        : { inReplyToMessageId: props.draft.inReplyToMessageId }),
    });
    setSending(false);
    if (sent) {
      props.onCancel();
    }
  }

  return (
    <form class="compose-form" onSubmit={(event) => void handleSend(event)}>
      <div class="field">
        <label for="compose-from">From</label>
        <Show
          when={props.sendableAddresses.length > 0}
          fallback={
            <p class="muted">
              No sender address is available to you. An administrator must add
              and verify a domain, and grant you a MAIL_SEND scope.
            </p>
          }
        >
          <select
            id="compose-from"
            value={from()}
            onChange={(event) => setFrom(event.currentTarget.value)}
          >
            <For each={props.sendableAddresses}>
              {(address) => <option value={address}>{address}</option>}
            </For>
          </select>
        </Show>
      </div>

      <div class="field">
        <label for="compose-to">To</label>
        <input
          id="compose-to"
          type="text"
          autocomplete="off"
          placeholder="someone@example.com, other@example.com"
          value={to()}
          onInput={(event) => setTo(event.currentTarget.value)}
        />
      </div>

      <div class="field">
        <label for="compose-cc">Cc</label>
        <input
          id="compose-cc"
          type="text"
          autocomplete="off"
          value={cc()}
          onInput={(event) => setCc(event.currentTarget.value)}
        />
      </div>

      <div class="field">
        <label for="compose-subject">Subject</label>
        <input
          id="compose-subject"
          type="text"
          value={subject()}
          onInput={(event) => setSubject(event.currentTarget.value)}
        />
      </div>

      <div class="field">
        <label for="compose-body">Message</label>
        <textarea
          id="compose-body"
          rows={16}
          value={text()}
          onInput={(event) => setText(event.currentTarget.value)}
        />
      </div>

      <div class="field">
        <label for="compose-files">Attachments</label>
        <input
          id="compose-files"
          type="file"
          multiple
          disabled={uploading()}
          onChange={(event) => void handleFiles(event.currentTarget.files)}
        />
        <Show when={attachments().length > 0}>
          <ul class="compose-attachments">
            <For each={attachments()}>
              {(attachment) => <li>{attachment.fileName}</li>}
            </For>
          </ul>
        </Show>
      </div>

      <div class="row">
        <button
          type="submit"
          class="primary"
          disabled={
            sending() || uploading() || props.sendableAddresses.length === 0
          }
        >
          {sending() ? "Sending..." : "Send"}
        </button>
        <Show when={props.onSaveDraft !== undefined}>
          <button
            type="button"
            disabled={savingDraft() || sending() || uploading()}
            onClick={() => void handleSaveDraft()}
          >
            {savingDraft() ? "Saving..." : "Save draft"}
          </button>
        </Show>
        <button type="button" onClick={() => props.onCancel()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
