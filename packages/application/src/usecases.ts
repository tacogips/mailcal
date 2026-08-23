import type { ApiKey, ApiKeyScope } from "@yabumi/domain/entities/api-key";
import type { MessageFetchState } from "@yabumi/domain/entities/fetch-state";
import type { FileLink } from "@yabumi/domain/entities/file-link";
import type {
  DomainStatus,
  MailDomain,
} from "@yabumi/domain/entities/mail-domain";
import type { ClassificationRule } from "@yabumi/domain/entities/classification-rule";
import type { Message } from "@yabumi/domain/entities/message";
import type { MessageEvent } from "@yabumi/domain/entities/message-event";
import type { Tag } from "@yabumi/domain/entities/tag";
import type { User } from "@yabumi/domain/entities/user";
import type {
  ClassificationRuleId,
  MessageEventId,
  ApiKeyId,
  ApiKeyScopeId,
  AttachmentId,
  DomainId,
  FileLinkId,
  MessageId,
  TagId,
  ThreadId,
} from "@yabumi/domain/value-objects/ids";
import type { AppDependencies } from "./dependencies";
import type { Viewer } from "./policies/viewer";
import type { MessagePage } from "./ports/message-repository";
import {
  type ApiKeyScopeInput,
  type ApiKeyWithSecret,
  type CreateApiKeyUseCaseInput,
  createAddApiKeyScopeUseCase,
  createCreateApiKeyUseCase,
  createListApiKeyScopesUseCase,
  createListApiKeysUseCase,
  createRemoveApiKeyScopeUseCase,
  createRevokeApiKeyUseCase,
} from "./usecases/api-keys";
import {
  createGetViewerUserUseCase,
  createLogoutUseCase,
  createResolveViewerFromTokenUseCase,
} from "./usecases/auth";
import {
  buildDomainDnsRecords,
  createCreateDomainUseCase,
  createDeleteDomainUseCase,
  createGetDomainUseCase,
  createListDomainsUseCase,
  createSetDomainStatusUseCase,
  createVerifyDomainUseCase,
  type DnsRecord,
} from "./usecases/domains";
import {
  type BootstrapResult,
  createBootstrapAdminUseCase,
  createRequestEmailAuthUseCase,
  createSweepExpiredAuthUseCase,
  createVerifyEmailAuthTokenUseCase,
  type EmailAuthSession,
} from "./usecases/email-auth";
import {
  createMarkMessagesFetchedUseCase,
  createMarkMessagesNotFetchedUseCase,
  createResolveFetchStatesUseCase,
} from "./usecases/fetch-state";
import {
  type CreatedFileLink,
  createCreateAttachmentLinkUseCase,
  createCreateRawMessageLinkUseCase,
  createListFileLinksUseCase,
  createResolveFileLinkUseCase,
  createRevokeFileLinkUseCase,
  createSweepExpiredFileLinksUseCase,
  type FileLinkDownload,
} from "./usecases/file-links";
import {
  createReceiveMessageUseCase,
  type ReceiveMessageInput,
  type ReceiveMessageResult,
} from "./usecases/ingest";
import {
  createDeleteMessagesUseCase,
  createGetMessageUseCase,
  createGetThreadUseCase,
  createListMessagesUseCase,
  createMarkReadUseCase,
  type ListMessagesInput,
  type ThreadView,
} from "./usecases/messages";
import {
  createListSendableAddressesUseCase,
  createRetrySendUseCase,
  createSendMessageUseCase,
  type SendMessageInput,
} from "./usecases/send";
import {
  createMarkNotSpamUseCase,
  createMarkSpamUseCase,
  createTagMessagesUseCase,
  createUntagMessagesUseCase,
} from "./usecases/tagging";
import {
  createCreateTagUseCase,
  createDeleteTagUseCase,
  createEnsureSystemTagsUseCase,
  createListTagsUseCase,
  createRenameTagUseCase,
} from "./usecases/tags";
import {
  createSaveDraftUseCase,
  createSendDraftUseCase,
  type SaveDraftInput,
} from "./usecases/drafts";
import {
  type CreateMessageEventInput,
  createCreateMessageEventUseCase,
  createDeleteMessageEventUseCase,
  createListEventsByMessagesUseCase,
  createListMessageEventsUseCase,
  createUpdateMessageEventUseCase,
  type ListMessageEventsInput,
  type UpdateMessageEventInput,
} from "./usecases/events";
import {
  createApplyClassificationRuleUseCase,
  createCreateClassificationRuleUseCase,
  createDeleteClassificationRuleUseCase,
  createListClassificationRulesUseCase,
  createSetClassificationRuleEnabledUseCase,
  type CreateRuleInput,
  type RuleApplication,
} from "./usecases/rules";

/** One flat object of pre-bound use cases, constructed once per isolate at
 * the composition root. Every transport (GraphQL, the REST routes, the
 * Worker's `email()` handler, the CLI) calls through this and nothing else,
 * so authorization and validation can never be bypassed by reaching for a
 * repository directly. */
export interface UseCases {
  // --- auth ---
  readonly resolveViewerFromToken: (token: string) => Promise<Viewer | null>;
  readonly logout: (token: string) => Promise<boolean>;
  readonly getViewerUser: (viewer: Viewer) => Promise<User | null>;
  readonly requestEmailAuth: (email: string) => Promise<boolean>;
  readonly verifyEmailAuthToken: (token: string) => Promise<EmailAuthSession>;
  readonly bootstrapAdmin: (
    email: string,
    name: string,
  ) => Promise<BootstrapResult>;
  readonly sweepExpiredAuth: () => Promise<void>;

  // --- inbound ---
  readonly receiveMessage: (
    input: ReceiveMessageInput,
  ) => Promise<ReceiveMessageResult>;

  // --- outbound ---
  readonly sendMessage: (
    viewer: Viewer,
    input: SendMessageInput,
  ) => Promise<Message>;
  readonly saveDraft: (
    viewer: Viewer,
    input: SaveDraftInput,
  ) => Promise<Message>;
  readonly sendDraft: (viewer: Viewer, draftId: MessageId) => Promise<Message>;
  readonly retrySend: (
    viewer: Viewer,
    messageId: MessageId,
  ) => Promise<Message>;
  readonly listSendableAddresses: (
    viewer: Viewer,
  ) => Promise<readonly string[]>;

  // --- reading ---
  readonly listMessages: (
    viewer: Viewer,
    input: ListMessagesInput,
  ) => Promise<MessagePage>;
  readonly getMessage: (
    viewer: Viewer,
    id: MessageId,
  ) => Promise<Message | null>;
  readonly getThread: (
    viewer: Viewer,
    id: ThreadId,
  ) => Promise<ThreadView | null>;
  readonly markRead: (
    viewer: Viewer,
    ids: readonly MessageId[],
    read: boolean,
  ) => Promise<readonly Message[]>;
  readonly deleteMessages: (
    viewer: Viewer,
    ids: readonly MessageId[],
  ) => Promise<number>;

  // --- fetch state ---
  readonly markMessagesFetched: (
    viewer: Viewer,
    ids: readonly MessageId[],
  ) => Promise<readonly Message[]>;
  readonly markMessagesNotFetched: (
    viewer: Viewer,
    ids: readonly MessageId[],
  ) => Promise<readonly Message[]>;
  readonly resolveFetchStates: (
    viewer: Viewer,
    ids: readonly MessageId[],
  ) => Promise<ReadonlyMap<string, MessageFetchState>>;

  // --- tagging ---
  readonly listTags: (viewer: Viewer) => Promise<readonly Tag[]>;
  readonly createTag: (
    viewer: Viewer,
    name: string,
    color: string | null,
  ) => Promise<Tag>;
  readonly renameTag: (
    viewer: Viewer,
    id: TagId,
    name: string,
    color: string | null,
  ) => Promise<Tag>;
  readonly deleteTag: (viewer: Viewer, id: TagId) => Promise<boolean>;
  readonly ensureSystemTags: () => Promise<readonly Tag[]>;
  readonly tagMessages: (
    viewer: Viewer,
    messageIds: readonly MessageId[],
    tagIds: readonly TagId[],
  ) => Promise<readonly Message[]>;
  readonly untagMessages: (
    viewer: Viewer,
    messageIds: readonly MessageId[],
    tagIds: readonly TagId[],
  ) => Promise<readonly Message[]>;
  // --- events ---
  readonly createMessageEvent: (
    viewer: Viewer,
    input: CreateMessageEventInput,
  ) => Promise<MessageEvent>;
  readonly updateMessageEvent: (
    viewer: Viewer,
    id: MessageEventId,
    input: UpdateMessageEventInput,
  ) => Promise<MessageEvent>;
  readonly deleteMessageEvent: (
    viewer: Viewer,
    id: MessageEventId,
  ) => Promise<boolean>;
  readonly listMessageEvents: (
    viewer: Viewer,
    input: ListMessageEventsInput,
  ) => Promise<readonly MessageEvent[]>;
  readonly listEventsByMessages: (
    ids: readonly MessageId[],
  ) => Promise<ReadonlyMap<string, readonly MessageEvent[]>>;

  // --- classification rules ---
  readonly createClassificationRule: (
    viewer: Viewer,
    input: CreateRuleInput,
  ) => Promise<ClassificationRule>;
  readonly setClassificationRuleEnabled: (
    viewer: Viewer,
    id: ClassificationRuleId,
    enabled: boolean,
  ) => Promise<ClassificationRule>;
  readonly deleteClassificationRule: (
    viewer: Viewer,
    id: ClassificationRuleId,
  ) => Promise<boolean>;
  readonly listClassificationRules: (
    viewer: Viewer,
  ) => Promise<readonly ClassificationRule[]>;
  readonly applyClassificationRule: (
    viewer: Viewer,
    id: ClassificationRuleId,
  ) => Promise<RuleApplication>;

  readonly markSpam: (
    viewer: Viewer,
    messageIds: readonly MessageId[],
  ) => Promise<readonly Message[]>;
  readonly markNotSpam: (
    viewer: Viewer,
    messageIds: readonly MessageId[],
  ) => Promise<readonly Message[]>;

  // --- domains ---
  readonly listDomains: (viewer: Viewer) => Promise<readonly MailDomain[]>;
  readonly getDomain: (
    viewer: Viewer,
    id: DomainId,
  ) => Promise<MailDomain | null>;
  readonly createDomain: (
    viewer: Viewer,
    name: string,
    catchAll: boolean,
  ) => Promise<MailDomain>;
  readonly verifyDomain: (viewer: Viewer, id: DomainId) => Promise<MailDomain>;
  readonly setDomainStatus: (
    viewer: Viewer,
    id: DomainId,
    status: DomainStatus,
  ) => Promise<MailDomain>;
  readonly deleteDomain: (viewer: Viewer, id: DomainId) => Promise<boolean>;
  readonly domainDnsRecords: (domain: MailDomain) => readonly DnsRecord[];

  // --- api keys ---
  readonly listApiKeys: (viewer: Viewer) => Promise<readonly ApiKey[]>;
  readonly listApiKeyScopes: (
    viewer: Viewer,
    ids: readonly ApiKeyId[],
  ) => Promise<ReadonlyMap<string, readonly ApiKeyScope[]>>;
  readonly createApiKey: (
    viewer: Viewer,
    input: CreateApiKeyUseCaseInput,
  ) => Promise<ApiKeyWithSecret>;
  readonly revokeApiKey: (viewer: Viewer, id: ApiKeyId) => Promise<ApiKey>;
  readonly addApiKeyScope: (
    viewer: Viewer,
    apiKeyId: ApiKeyId,
    scope: ApiKeyScopeInput,
  ) => Promise<readonly ApiKeyScope[]>;
  readonly removeApiKeyScope: (
    viewer: Viewer,
    scopeId: ApiKeyScopeId,
  ) => Promise<boolean>;

  // --- file links ---
  readonly createAttachmentLink: (
    viewer: Viewer,
    attachmentId: AttachmentId,
    ttlSeconds?: number,
    maxDownloads?: number | null,
  ) => Promise<CreatedFileLink>;
  readonly createRawMessageLink: (
    viewer: Viewer,
    messageId: MessageId,
    ttlSeconds?: number,
    maxDownloads?: number | null,
  ) => Promise<CreatedFileLink>;
  readonly revokeFileLink: (viewer: Viewer, id: FileLinkId) => Promise<boolean>;
  readonly listFileLinks: (
    viewer: Viewer,
    messageId: MessageId,
  ) => Promise<readonly FileLink[]>;
  /** Unauthenticated by design: the token is the credential. */
  readonly resolveFileLink: (token: string) => Promise<FileLinkDownload | null>;
  readonly sweepExpiredFileLinks: () => Promise<number>;
}

export function createUseCases(deps: AppDependencies): UseCases {
  return {
    resolveViewerFromToken: createResolveViewerFromTokenUseCase(deps),
    logout: createLogoutUseCase(deps),
    getViewerUser: createGetViewerUserUseCase(deps),
    requestEmailAuth: createRequestEmailAuthUseCase(deps),
    verifyEmailAuthToken: createVerifyEmailAuthTokenUseCase(deps),
    bootstrapAdmin: createBootstrapAdminUseCase(deps),
    sweepExpiredAuth: createSweepExpiredAuthUseCase(deps),

    receiveMessage: createReceiveMessageUseCase(deps),

    sendMessage: createSendMessageUseCase(deps),
    saveDraft: createSaveDraftUseCase(deps),
    sendDraft: createSendDraftUseCase(deps),
    retrySend: createRetrySendUseCase(deps),
    listSendableAddresses: createListSendableAddressesUseCase(deps),

    listMessages: createListMessagesUseCase(deps),
    getMessage: createGetMessageUseCase(deps),
    getThread: createGetThreadUseCase(deps),
    markRead: createMarkReadUseCase(deps),
    deleteMessages: createDeleteMessagesUseCase(deps),

    markMessagesFetched: createMarkMessagesFetchedUseCase(deps),
    markMessagesNotFetched: createMarkMessagesNotFetchedUseCase(deps),
    resolveFetchStates: createResolveFetchStatesUseCase(deps),

    listTags: createListTagsUseCase(deps),
    createTag: createCreateTagUseCase(deps),
    renameTag: createRenameTagUseCase(deps),
    deleteTag: createDeleteTagUseCase(deps),
    ensureSystemTags: createEnsureSystemTagsUseCase(deps),
    tagMessages: createTagMessagesUseCase(deps),
    untagMessages: createUntagMessagesUseCase(deps),
    createMessageEvent: createCreateMessageEventUseCase(deps),
    updateMessageEvent: createUpdateMessageEventUseCase(deps),
    deleteMessageEvent: createDeleteMessageEventUseCase(deps),
    listMessageEvents: createListMessageEventsUseCase(deps),
    listEventsByMessages: createListEventsByMessagesUseCase(deps),
    createClassificationRule: createCreateClassificationRuleUseCase(deps),
    setClassificationRuleEnabled:
      createSetClassificationRuleEnabledUseCase(deps),
    deleteClassificationRule: createDeleteClassificationRuleUseCase(deps),
    listClassificationRules: createListClassificationRulesUseCase(deps),
    applyClassificationRule: createApplyClassificationRuleUseCase(deps),
    markSpam: createMarkSpamUseCase(deps),
    markNotSpam: createMarkNotSpamUseCase(deps),

    listDomains: createListDomainsUseCase(deps),
    getDomain: createGetDomainUseCase(deps),
    createDomain: createCreateDomainUseCase(deps),
    verifyDomain: createVerifyDomainUseCase(deps),
    setDomainStatus: createSetDomainStatusUseCase(deps),
    deleteDomain: createDeleteDomainUseCase(deps),
    domainDnsRecords: buildDomainDnsRecords,

    listApiKeys: createListApiKeysUseCase(deps),
    listApiKeyScopes: createListApiKeyScopesUseCase(deps),
    createApiKey: createCreateApiKeyUseCase(deps),
    revokeApiKey: createRevokeApiKeyUseCase(deps),
    addApiKeyScope: createAddApiKeyScopeUseCase(deps),
    removeApiKeyScope: createRemoveApiKeyScopeUseCase(deps),

    createAttachmentLink: createCreateAttachmentLinkUseCase(deps),
    createRawMessageLink: createCreateRawMessageLinkUseCase(deps),
    revokeFileLink: createRevokeFileLinkUseCase(deps),
    listFileLinks: createListFileLinksUseCase(deps),
    resolveFileLink: createResolveFileLinkUseCase(deps),
    sweepExpiredFileLinks: createSweepExpiredFileLinksUseCase(deps),
  };
}

export type {
  ApiKeyScopeInput,
  BootstrapResult,
  ApiKeyWithSecret,
  CreateApiKeyUseCaseInput,
  CreatedFileLink,
  DnsRecord,
  EmailAuthSession,
  FileLinkDownload,
  ListMessagesInput,
  ReceiveMessageInput,
  ReceiveMessageResult,
  SendMessageInput,
  ThreadView,
};
