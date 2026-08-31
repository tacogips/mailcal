import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MessageDetailView } from "../api/schema-types";
import { clearContactLookupCache } from "../lib/contact-lookup";
import { MessageView } from "./message-view";

function message(
  overrides: Partial<MessageDetailView> = {},
): MessageDetailView {
  return {
    id: "msg-1",
    threadId: "thread-1",
    direction: "INBOUND",
    subject: "Hello",
    snippet: "Hi there",
    from: {
      address: "ada@example.com",
      name: "Ada Lovelace",
      kind: "ENVELOPE",
    },
    recipients: [{ address: "me@example.com", name: null, kind: "TO" }],
    tags: [],
    attachments: [],
    isSpam: false,
    spam: null,
    spamScore: null,
    status: "RECEIVED",
    deliveryStatus: "RECEIVED",
    listId: null,
    isMailingList: false,
    deliveryError: null,
    readAt: null,
    fetchStatus: "FETCHED",
    occurredAt: "2026-08-24T00:00:00.000Z",
    domain: { id: "dom-1", name: "example.com" },
    events: [],
    textBody: "Hi there",
    htmlBody: null,
    bodyTruncated: false,
    rfcMessageId: null,
    rawSize: 100,
    ...overrides,
  };
}

const NOOP = () => undefined;

function mount(detail: MessageDetailView): {
  readonly container: HTMLElement;
  readonly dispose: () => void;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispose = render(
    () => (
      <MessageView
        message={detail}
        onReply={NOOP}
        onForward={NOOP}
        onNotSpam={NOOP}
        onMarkSpam={NOOP}
        onMarkUnread={NOOP}
        onDelete={NOOP}
        onToggleStar={NOOP}
        onToggleArchive={NOOP}
      />
    ),
    container,
  );
  return {
    container,
    dispose: () => {
      dispose();
      container.remove();
    },
  };
}

async function flushMicrotasks(): Promise<void> {
  // The lookup hook resolves through several chained promises (the fetch,
  // its `.json()`, the cache-population `.then`, Solid's own scheduler),
  // so a macrotask tick is the reliable way to wait for the resulting
  // signal write to land, rather than guessing a microtask count.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function stubGraphQL(contactsByEmail: readonly unknown[]): void {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify({ data: { contactsByEmail } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  clearContactLookupCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MessageView contact lookup hook", () => {
  test("renders the sender and recipients synchronously, before the lookup resolves", () => {
    stubGraphQL([]);
    const { container, dispose } = mount(message());
    // No `await` yet: the initial paint must already show the message, so
    // the lookup cannot be on the critical render path.
    expect(
      container.querySelector(".message-view-sender-col strong")?.textContent,
    ).toContain("Ada Lovelace");
    expect(container.textContent).toContain("Hi there");
    dispose();
  });

  test("no match renders identically to the pre-contacts markup", async () => {
    stubGraphQL([]);
    const { container, dispose } = mount(message());
    await flushMicrotasks();

    expect(container.querySelector(".message-view-contact-hint")).toBeNull();
    expect(container.querySelector(".message-view-contact-hints")).toBeNull();
    expect(
      container.querySelector(".message-view-sender-col strong")?.textContent,
    ).toBe("Ada Lovelace <ada@example.com>");
    dispose();
  });

  test("a matching sender gets a name hint linking to /contacts", async () => {
    stubGraphQL([
      {
        id: "contact-1",
        addressBook: {
          id: "book-1",
          name: "Contacts",
          mailAddress: { id: "addr-1", address: "me@example.com" },
        },
        uid: "contact-1@mailcal",
        displayName: "Ada L.",
        givenName: null,
        familyName: null,
        nickname: null,
        organization: null,
        title: null,
        emails: [{ address: "ada@example.com", label: null }],
        phones: [],
        postalAddresses: [],
        urls: [],
        note: null,
        birthday: null,
        createdAt: "2026-08-24T00:00:00.000Z",
        updatedAt: "2026-08-24T00:00:00.000Z",
      },
    ]);
    const { container, dispose } = mount(message());
    await flushMicrotasks();

    const hint = container.querySelector<HTMLAnchorElement>(
      ".message-view-contact-hint",
    );
    expect(hint?.textContent).toBe("(Ada L.)");
    expect(hint?.getAttribute("href")).toBe("/contacts?contactId=contact-1");
    dispose();
  });
});
