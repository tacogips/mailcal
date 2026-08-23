import { Capability } from "@yabumi/domain/entities/api-key";
import { FetchStatus } from "@yabumi/domain/entities/fetch-state";
import {
  createInboundMessage,
  type Message,
  MessageDirection,
  type MessageRecipient,
  RecipientKind,
} from "@yabumi/domain/entities/message";
import { createEmailAddress } from "@yabumi/domain/value-objects/email-address";
import {
  createDomainId,
  createMessageId,
  createThreadId,
} from "@yabumi/domain/value-objects/ids";
import { beforeEach, describe, expect, test } from "vitest";
import { BadUserInputError } from "../errors";
import {
  createFakeDependencies,
  type FakeDependencies,
} from "../test-support/fakes";
import {
  adminViewer,
  apiKeyViewer,
  mailboxAgentViewer,
} from "../test-support/viewer-fixtures";
import {
  createMarkMessagesFetchedUseCase,
  createMarkMessagesNotFetchedUseCase,
} from "./fetch-state";
import {
  createDeleteMessagesUseCase,
  createGetMessageUseCase,
  createGetThreadUseCase,
  createListMessagesUseCase,
  createMarkReadUseCase,
  MAX_PAGE_SIZE,
} from "./messages";
import { createMarkSpamUseCase } from "./tagging";

const NOW = "2026-08-23T00:00:00.000Z";
const domainId = createDomainId("dom-1");

interface SeedOptions {
  readonly id: string;
  readonly to: string;
  readonly occurredAt: string;
  readonly subject?: string;
  readonly threadId?: string;
  readonly rawKey?: string | null;
}

function seedMessage(fake: FakeDependencies, options: SeedOptions): Message {
  const messageId = createMessageId(options.id);
  const message = createInboundMessage({
    id: messageId,
    domainId,
    threadId: createThreadId(options.threadId ?? options.id),
    rfcMessageId: `${options.id}@other.com`,
    inReplyTo: null,
    references: [],
    subject: options.subject ?? `Subject ${options.id}`,
    fromAddress: createEmailAddress("sender@other.com"),
    fromName: null,
    textBody: "body",
    htmlBody: null,
    rawKey:
      options.rawKey === undefined ? `raw/${options.id}.eml` : options.rawKey,
    rawSize: 100,
    occurredAt: options.occurredAt,
    createdAt: options.occurredAt,
    spamScore: null,
  });
  const recipients: readonly MessageRecipient[] = [
    {
      kind: RecipientKind.Envelope,
      address: createEmailAddress(options.to),
      name: null,
      position: 0,
    },
  ];
  fake.messageStores.messages.set(message.id, message);
  fake.messageStores.recipients.set(message.id, [...recipients]);
  fake.messageStores.messageTags.set(message.id, new Set());
  return message;
}

describe("listMessages", () => {
  let fake: FakeDependencies;

  beforeEach(() => {
    fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-1",
      to: "support@example.com",
      occurredAt: "2026-08-23T01:00:00.000Z",
    });
    seedMessage(fake, {
      id: "msg-2",
      to: "billing@example.com",
      occurredAt: "2026-08-23T02:00:00.000Z",
    });
    seedMessage(fake, {
      id: "msg-3",
      to: "support@example.com",
      occurredAt: "2026-08-23T03:00:00.000Z",
    });
  });

  test("a user sees every message, newest first", async () => {
    const list = createListMessagesUseCase(fake.deps);
    const page = await list(adminViewer(), {});
    expect(page.nodes.map((message) => message.id)).toEqual([
      "msg-3",
      "msg-2",
      "msg-1",
    ]);
    expect(page.totalCount).toBe(3);
  });

  test("a scoped key sees only its own mailbox", async () => {
    const list = createListMessagesUseCase(fake.deps);
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    const page = await list(viewer, {});
    expect(page.nodes.map((message) => message.id)).toEqual(["msg-3", "msg-1"]);
  });

  test("a key with no read scope sees nothing", async () => {
    const list = createListMessagesUseCase(fake.deps);
    const viewer = apiKeyViewer([
      { capability: Capability.MailSend, domainId },
    ]);
    const page = await list(viewer, {});
    expect(page.nodes).toEqual([]);
    expect(page.totalCount).toBe(0);
  });

  test("excludes spam by default and includes it on request", async () => {
    const markSpam = createMarkSpamUseCase(fake.deps);
    await markSpam(adminViewer(), [createMessageId("msg-2")]);

    const list = createListMessagesUseCase(fake.deps);
    const withoutSpam = await list(adminViewer(), {});
    expect(withoutSpam.nodes.map((message) => message.id)).toEqual([
      "msg-3",
      "msg-1",
    ]);

    const withSpam = await list(adminViewer(), {
      filter: { includeSpam: true },
    });
    expect(withSpam.nodes).toHaveLength(3);
  });

  test("filtering on the spam slug returns only spam", async () => {
    const markSpam = createMarkSpamUseCase(fake.deps);
    await markSpam(adminViewer(), [createMessageId("msg-2")]);

    const list = createListMessagesUseCase(fake.deps);
    const page = await list(adminViewer(), {
      filter: { spamOnly: true },
    });
    expect(page.nodes.map((message) => message.id)).toEqual(["msg-2"]);
  });

  test("paginates with a stable cursor", async () => {
    const list = createListMessagesUseCase(fake.deps);
    const first = await list(adminViewer(), { first: 2 });
    expect(first.nodes.map((message) => message.id)).toEqual([
      "msg-3",
      "msg-2",
    ]);
    expect(first.nextCursor).not.toBeNull();

    const second = await list(adminViewer(), {
      first: 2,
      after: first.nextCursor,
    });
    expect(second.nodes.map((message) => message.id)).toEqual(["msg-1"]);
    expect(second.nextCursor).toBeNull();
  });

  test("clamps an absurd page size", async () => {
    const list = createListMessagesUseCase(fake.deps);
    const page = await list(adminViewer(), { first: 100000 });
    expect(page.nodes.length).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });

  test("filters by direction, address and search", async () => {
    const list = createListMessagesUseCase(fake.deps);
    expect(
      (
        await list(adminViewer(), {
          filter: { direction: MessageDirection.Outbound },
        })
      ).nodes,
    ).toEqual([]);
    expect(
      (
        await list(adminViewer(), {
          filter: { toAddress: "billing@example.com" },
        })
      ).nodes.map((message) => message.id),
    ).toEqual(["msg-2"]);
    expect(
      (
        await list(adminViewer(), { filter: { search: "Subject msg-1" } })
      ).nodes.map((message) => message.id),
    ).toEqual(["msg-1"]);
  });

  test("rejects fetchStatus filtering for a user viewer", async () => {
    const list = createListMessagesUseCase(fake.deps);
    await expect(
      list(adminViewer(), { filter: { fetchStatus: "NOT_FETCHED" } }),
    ).rejects.toBeInstanceOf(BadUserInputError);
  });

  describe("fetch state filtering", () => {
    test("NOT_FETCHED matches messages with no state row", async () => {
      const viewer = mailboxAgentViewer(domainId, "*@example.com");
      const list = createListMessagesUseCase(fake.deps);
      const page = await list(viewer, {
        filter: { fetchStatus: "NOT_FETCHED" },
      });
      expect(page.nodes).toHaveLength(3);
    });

    test("acknowledged messages leave the NOT_FETCHED queue", async () => {
      const viewer = mailboxAgentViewer(domainId, "*@example.com");
      const ack = createMarkMessagesFetchedUseCase(fake.deps);
      await ack(viewer, [createMessageId("msg-3")]);

      const list = createListMessagesUseCase(fake.deps);
      const pending = await list(viewer, {
        filter: { fetchStatus: "NOT_FETCHED" },
      });
      expect(pending.nodes.map((message) => message.id)).toEqual([
        "msg-2",
        "msg-1",
      ]);

      const fetched = await list(viewer, {
        filter: { fetchStatus: "FETCHED" },
      });
      expect(fetched.nodes.map((message) => message.id)).toEqual(["msg-3"]);
    });

    test("two keys track their queues independently", async () => {
      const agentA = mailboxAgentViewer(domainId, "*@example.com", "key-a");
      const agentB = mailboxAgentViewer(domainId, "*@example.com", "key-b");
      const ack = createMarkMessagesFetchedUseCase(fake.deps);
      await ack(agentA, [createMessageId("msg-3")]);

      const list = createListMessagesUseCase(fake.deps);
      expect(
        (await list(agentA, { filter: { fetchStatus: "NOT_FETCHED" } })).nodes,
      ).toHaveLength(2);
      expect(
        (await list(agentB, { filter: { fetchStatus: "NOT_FETCHED" } })).nodes,
      ).toHaveLength(3);
    });
  });
});

describe("getMessage", () => {
  let fake: FakeDependencies;

  beforeEach(() => {
    fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-1",
      to: "support@example.com",
      occurredAt: NOW,
    });
    seedMessage(fake, {
      id: "msg-2",
      to: "billing@example.com",
      occurredAt: NOW,
    });
  });

  test("returns a message the viewer may read", async () => {
    const get = createGetMessageUseCase(fake.deps);
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    const message = await get(viewer, createMessageId("msg-1"));
    expect(message?.id).toBe("msg-1");
  });

  test("returns null (not forbidden) for an out-of-scope message", async () => {
    const get = createGetMessageUseCase(fake.deps);
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    // Indistinguishable from an unknown id, so a scoped key cannot probe
    // for the existence of other mailboxes.
    await expect(get(viewer, createMessageId("msg-2"))).resolves.toBeNull();
    await expect(get(viewer, createMessageId("nope"))).resolves.toBeNull();
  });
});

describe("getThread", () => {
  test("returns only the messages the viewer may read", async () => {
    const fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-1",
      to: "support@example.com",
      occurredAt: "2026-08-23T01:00:00.000Z",
      threadId: "thr-1",
    });
    seedMessage(fake, {
      id: "msg-2",
      to: "billing@example.com",
      occurredAt: "2026-08-23T02:00:00.000Z",
      threadId: "thr-1",
    });

    const getThread = createGetThreadUseCase(fake.deps);
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    const thread = await getThread(viewer, createThreadId("thr-1"));
    expect(thread?.messages.map((message) => message.id)).toEqual(["msg-1"]);
  });

  test("returns null when nothing in the thread is visible", async () => {
    const fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-2",
      to: "billing@example.com",
      occurredAt: NOW,
      threadId: "thr-1",
    });
    const getThread = createGetThreadUseCase(fake.deps);
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    await expect(
      getThread(viewer, createThreadId("thr-1")),
    ).resolves.toBeNull();
  });
});

describe("markRead", () => {
  test("toggles the read timestamp", async () => {
    const fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-1",
      to: "support@example.com",
      occurredAt: NOW,
    });
    const markRead = createMarkReadUseCase(fake.deps);
    await markRead(adminViewer(), [createMessageId("msg-1")], true);
    expect(fake.messageStores.messages.get("msg-1")?.readAt).toBe(NOW);

    await markRead(adminViewer(), [createMessageId("msg-1")], false);
    expect(fake.messageStores.messages.get("msg-1")?.readAt).toBeNull();
  });

  test("silently skips messages outside the viewer's scope", async () => {
    const fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-2",
      to: "billing@example.com",
      occurredAt: NOW,
    });
    const markRead = createMarkReadUseCase(fake.deps);
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    const updated = await markRead(viewer, [createMessageId("msg-2")], true);
    expect(updated).toEqual([]);
    expect(fake.messageStores.messages.get("msg-2")?.readAt).toBeNull();
  });
});

describe("deleteMessages", () => {
  test("removes rows and then blob bodies", async () => {
    const fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-1",
      to: "support@example.com",
      occurredAt: NOW,
    });
    await fake.deps.blobs.put("raw/msg-1.eml", new Uint8Array([1]));

    const remove = createDeleteMessagesUseCase(fake.deps);
    const count = await remove(adminViewer(), [createMessageId("msg-1")]);

    expect(count).toBe(1);
    expect(fake.messageStores.messages.has("msg-1")).toBe(false);
    expect(fake.blobs.keys()).not.toContain("raw/msg-1.eml");
  });

  test("does not delete messages outside the viewer's scope", async () => {
    const fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-2",
      to: "billing@example.com",
      occurredAt: NOW,
    });
    const remove = createDeleteMessagesUseCase(fake.deps);
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    expect(await remove(viewer, [createMessageId("msg-2")])).toBe(0);
    expect(fake.messageStores.messages.has("msg-2")).toBe(true);
  });
});

describe("fetch state acknowledgment", () => {
  let fake: FakeDependencies;

  beforeEach(() => {
    fake = createFakeDependencies({ now: NOW });
    seedMessage(fake, {
      id: "msg-1",
      to: "support@example.com",
      occurredAt: NOW,
    });
  });

  test("is idempotent, preserving the original fetchedAt", async () => {
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    const ack = createMarkMessagesFetchedUseCase(fake.deps);
    await ack(viewer, [createMessageId("msg-1")]);

    fake.clock.set("2026-08-23T05:00:00.000Z");
    await ack(viewer, [createMessageId("msg-1")]);

    const states = await fake.deps.messageRepository.findFetchStates(
      viewer.kind === "API_KEY" ? viewer.apiKeyId : ("" as never),
      [createMessageId("msg-1")],
    );
    expect(states.get("msg-1")?.fetchedAt).toBe(NOW);
    expect(states.get("msg-1")?.status).toBe(FetchStatus.Fetched);
  });

  test("can be reversed to replay a message", async () => {
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    const ack = createMarkMessagesFetchedUseCase(fake.deps);
    const unack = createMarkMessagesNotFetchedUseCase(fake.deps);
    await ack(viewer, [createMessageId("msg-1")]);
    await unack(viewer, [createMessageId("msg-1")]);

    const states = await fake.deps.messageRepository.findFetchStates(
      viewer.kind === "API_KEY" ? viewer.apiKeyId : ("" as never),
      [createMessageId("msg-1")],
    );
    expect(states.get("msg-1")?.status).toBe(FetchStatus.NotFetched);
    expect(states.get("msg-1")?.fetchedAt).toBeNull();
  });

  test("rejects a user viewer", async () => {
    const ack = createMarkMessagesFetchedUseCase(fake.deps);
    await expect(
      ack(adminViewer(), [createMessageId("msg-1")]),
    ).rejects.toBeInstanceOf(BadUserInputError);
  });

  test("skips messages the key may not manage", async () => {
    seedMessage(fake, {
      id: "msg-2",
      to: "billing@example.com",
      occurredAt: NOW,
    });
    const viewer = mailboxAgentViewer(domainId, "support@example.com");
    const ack = createMarkMessagesFetchedUseCase(fake.deps);
    const acked = await ack(viewer, [
      createMessageId("msg-1"),
      createMessageId("msg-2"),
    ]);
    expect(acked.map((message) => message.id)).toEqual(["msg-1"]);
  });
});
