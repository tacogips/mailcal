import type { AppDependencies, InstanceConfig } from "../dependencies";
import {
  createClassificationRuleRepositoryFake,
  createFakeEventStores,
  createFakeRuleStores,
  createMessageEventRepositoryFake,
  type FakeEventStores,
  type FakeRuleStores,
} from "./event-and-rule-fakes";
import {
  createFakeMessageStores,
  type FakeMessageStores,
  fakeMessageRepository,
} from "./message-repository-fake";
import {
  createFakeStores,
  fakeApiKeyRepository,
  fakeEmailAuthChallengeRepository,
  fakeFileLinkRepository,
  fakeMailDomainRepository,
  fakeSessionRepository,
  fakeTagRepository,
  fakeUserRepository,
  type FakeStores,
  seedSystemTags,
} from "./repository-fakes";
import {
  type FixedClock,
  fixedClock,
  type MemoryBlobStore,
  memoryBlobStore,
  plainTokenHasher,
  type RecordingMailSender,
  recordingMailSender,
  sequenceRandom,
  type StubMimeParser,
  stubMimeParser,
  stubMimeBuilder,
  unusedSqlDatabase,
} from "./runtime-fakes";

export * from "./message-repository-fake";
export * from "./repository-fakes";
export * from "./runtime-fakes";

export const DEFAULT_INSTANCE_CONFIG: InstanceConfig = {
  signupMode: "closed",
  publicOrigin: "https://mail.example.com",
  mailFrom: "postmaster@example.com",
  spamThreshold: 0.6,
  spamPhrases: [],
  fileLinkMaxTtlSeconds: 604800,
};

/** Everything a test may want to reach into after driving a use case. */
export interface FakeDependencies {
  readonly deps: AppDependencies;
  readonly stores: FakeStores;
  readonly messageStores: FakeMessageStores;
  readonly eventStores: FakeEventStores;
  readonly ruleStores: FakeRuleStores;
  readonly clock: FixedClock;
  readonly blobs: MemoryBlobStore;
  readonly mailSender: RecordingMailSender;
  readonly mimeParser: StubMimeParser;
}

export interface CreateFakeDependenciesOptions {
  readonly instanceConfig?: Partial<InstanceConfig>;
  readonly now?: string;
  readonly idPrefix?: string;
  /** Seeds the system tags, as the migrations do. Defaults to true. */
  readonly seedSystemTags?: boolean;
}

/** Builds a fully in-memory `AppDependencies` plus handles on its backing
 * stores. Every use case test starts here; no adapter is involved. */
export function createFakeDependencies(
  options: CreateFakeDependenciesOptions = {},
): FakeDependencies {
  const now = options.now ?? "2026-08-23T00:00:00.000Z";
  const stores = createFakeStores();
  const messageStores = createFakeMessageStores();
  const eventStores = createFakeEventStores();
  const ruleStores = createFakeRuleStores();
  const clock = fixedClock(now);
  const blobs = memoryBlobStore();
  const mailSender = recordingMailSender();
  const mimeParser = stubMimeParser();

  if (options.seedSystemTags !== false) {
    seedSystemTags(stores, now);
  }

  const deps: AppDependencies = {
    db: unusedSqlDatabase(),
    blobs,
    clock,
    random: sequenceRandom(options.idPrefix ?? "id"),
    tokenHasher: plainTokenHasher(),
    mimeParser,
    mimeBuilder: stubMimeBuilder(),
    mailSender,
    mailDomainRepository: fakeMailDomainRepository(stores),
    messageRepository: fakeMessageRepository(messageStores),
    messageEventRepository: createMessageEventRepositoryFake(
      eventStores,
      messageStores,
    ),
    classificationRuleRepository:
      createClassificationRuleRepositoryFake(ruleStores),
    tagRepository: fakeTagRepository(stores),
    apiKeyRepository: fakeApiKeyRepository(stores),
    fileLinkRepository: fakeFileLinkRepository(stores),
    userRepository: fakeUserRepository(stores),
    sessionRepository: fakeSessionRepository(stores),
    emailAuthChallengeRepository: fakeEmailAuthChallengeRepository(stores),
    instanceConfig: {
      ...DEFAULT_INSTANCE_CONFIG,
      ...options.instanceConfig,
    },
  };

  return {
    deps,
    stores,
    messageStores,
    eventStores,
    ruleStores,
    clock,
    blobs,
    mailSender,
    mimeParser,
  };
}
