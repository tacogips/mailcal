import { describe, expect, test } from "vitest";
import { ValidationError } from "../errors";
import {
  createApiKeyId,
  createApiKeyScopeId,
  createAttachmentId,
  createDomainId,
  createEmailAuthChallengeId,
  createFileLinkId,
  createMessageId,
  createSessionId,
  createTagId,
  createThreadId,
  createUserId,
  createUserMailPermissionId,
} from "./ids";

const constructors = [
  ["domainId", createDomainId],
  ["messageId", createMessageId],
  ["threadId", createThreadId],
  ["attachmentId", createAttachmentId],
  ["tagId", createTagId],
  ["apiKeyId", createApiKeyId],
  ["apiKeyScopeId", createApiKeyScopeId],
  ["fileLinkId", createFileLinkId],
  ["userId", createUserId],
  ["userMailPermissionId", createUserMailPermissionId],
  ["sessionId", createSessionId],
  ["emailAuthChallengeId", createEmailAuthChallengeId],
] as const;

describe("branded id constructors", () => {
  test.each(constructors)("%s accepts a non-empty value", (_field, create) => {
    expect(create("abc-123")).toBe("abc-123");
  });

  test.each(constructors)("%s rejects an empty value", (field, create) => {
    expect(() => create("")).toThrow(ValidationError);
    try {
      create("");
    } catch (error) {
      expect((error as ValidationError).field).toBe(field);
    }
  });

  test.each(constructors)(
    "%s rejects a whitespace-only value",
    (_field, create) => {
      expect(() => create("   ")).toThrow(ValidationError);
    },
  );
});
