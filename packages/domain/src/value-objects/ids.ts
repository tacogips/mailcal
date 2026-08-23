import { ValidationError } from "../errors";

/** Nominal-typing helper: attaches a phantom `__brand` tag to a primitive so
 * distinct entity IDs cannot be accidentally interchanged. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type DomainId = Brand<string, "DomainId">;
export type MessageId = Brand<string, "MessageId">;
export type ThreadId = Brand<string, "ThreadId">;
export type AttachmentId = Brand<string, "AttachmentId">;
export type TagId = Brand<string, "TagId">;
export type ApiKeyId = Brand<string, "ApiKeyId">;
export type ApiKeyScopeId = Brand<string, "ApiKeyScopeId">;
export type FileLinkId = Brand<string, "FileLinkId">;
export type UserId = Brand<string, "UserId">;
export type SessionId = Brand<string, "SessionId">;
export type EmailAuthChallengeId = Brand<string, "EmailAuthChallengeId">;
export type MessageEventId = Brand<string, "MessageEventId">;
export type ClassificationRuleId = Brand<string, "ClassificationRuleId">;

/** Shared validation for every branded ID constructor below. IDs are always
 * caller-supplied: the domain layer never generates them, so that entity
 * factories stay pure and deterministic under test. */
function requireNonEmptyId(value: string, fieldName: string): string {
  if (value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must not be empty`, fieldName);
  }
  return value;
}

export function createDomainId(value: string): DomainId {
  return requireNonEmptyId(value, "domainId") as DomainId;
}

export function createMessageId(value: string): MessageId {
  return requireNonEmptyId(value, "messageId") as MessageId;
}

export function createThreadId(value: string): ThreadId {
  return requireNonEmptyId(value, "threadId") as ThreadId;
}

export function createAttachmentId(value: string): AttachmentId {
  return requireNonEmptyId(value, "attachmentId") as AttachmentId;
}

export function createTagId(value: string): TagId {
  return requireNonEmptyId(value, "tagId") as TagId;
}

export function createApiKeyId(value: string): ApiKeyId {
  return requireNonEmptyId(value, "apiKeyId") as ApiKeyId;
}

export function createApiKeyScopeId(value: string): ApiKeyScopeId {
  return requireNonEmptyId(value, "apiKeyScopeId") as ApiKeyScopeId;
}

export function createFileLinkId(value: string): FileLinkId {
  return requireNonEmptyId(value, "fileLinkId") as FileLinkId;
}

export function createUserId(value: string): UserId {
  return requireNonEmptyId(value, "userId") as UserId;
}

export function createSessionId(value: string): SessionId {
  return requireNonEmptyId(value, "sessionId") as SessionId;
}

export function createEmailAuthChallengeId(
  value: string,
): EmailAuthChallengeId {
  return requireNonEmptyId(
    value,
    "emailAuthChallengeId",
  ) as EmailAuthChallengeId;
}

export function createMessageEventId(value: string): MessageEventId {
  return requireNonEmptyId(value, "messageEventId") as MessageEventId;
}

export function createClassificationRuleId(
  value: string,
): ClassificationRuleId {
  return requireNonEmptyId(
    value,
    "classificationRuleId",
  ) as ClassificationRuleId;
}
