import { createMemoryBlobStore } from "@yabumi/adapter/blob/memory";
import { createR2BlobStore } from "@yabumi/adapter/blob/r2";
import { createS3BlobStore } from "@yabumi/adapter/blob/s3";
import {
  createCryptoRandomSource,
  createSha256TokenHasher,
} from "@yabumi/adapter/crypto";
import {
  createCloudflareMailSender,
  createUnavailableMailSender,
} from "@yabumi/adapter/mail/cloudflare-email";
import { createMimeTextBuilder } from "@yabumi/adapter/mime/mime-builder";
import { createPostalMimeParser } from "@yabumi/adapter/mime/postal-mime-parser";
import { createApiKeyRepository } from "@yabumi/adapter/repositories/api-key-repository";
import {
  createEmailAuthChallengeRepository,
  createSessionRepository,
  createUserRepository,
} from "@yabumi/adapter/repositories/auth-repository";
import { createClassificationRuleRepository } from "@yabumi/adapter/repositories/classification-rule-repository";
import { createFileLinkRepository } from "@yabumi/adapter/repositories/file-link-repository";
import { createMessageEventRepository } from "@yabumi/adapter/repositories/message-event-repository";
import { createMailDomainRepository } from "@yabumi/adapter/repositories/mail-domain-repository";
import { createMessageRepository } from "@yabumi/adapter/repositories/message-repository";
import { createTagRepository } from "@yabumi/adapter/repositories/tag-repository";
import { createD1Database } from "@yabumi/adapter/sql/d1";
import { createLibsqlDatabase } from "@yabumi/adapter/sql/libsql";
import type { AppDependencies } from "@yabumi/application/dependencies";
import type { BlobStore } from "@yabumi/application/ports/blob-store";
import type { Clock } from "@yabumi/application/ports/runtime-ports";
import type { SqlDatabase } from "@yabumi/application/ports/sql-database";
import {
  type BuildDependenciesConfig,
  DEFAULT_FILE_LINK_MAX_TTL_SECONDS,
  DEFAULT_SPAM_THRESHOLD,
  DEFAULT_SQLITE_URL,
} from "./config";

/** Thrown when the config selects a backend without the binding or
 * credentials that backend needs. */
export class BuildDependenciesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuildDependenciesError";
  }
}

function systemClock(): Clock {
  return { now: () => new Date() };
}

function resolveDb(config: BuildDependenciesConfig): SqlDatabase {
  if (config.sqlBackend === "d1") {
    if (config.d1 === undefined) {
      throw new BuildDependenciesError(
        'sqlBackend "d1" requires a D1 binding (config.d1)',
      );
    }
    return createD1Database(config.d1);
  }
  return createLibsqlDatabase(config.sqliteUrl ?? DEFAULT_SQLITE_URL);
}

function resolveBlobs(config: BuildDependenciesConfig): BlobStore {
  if (config.blobBackend === "r2") {
    if (config.r2 === undefined) {
      throw new BuildDependenciesError(
        'blobBackend "r2" requires an R2 binding (config.r2)',
      );
    }
    return createR2BlobStore(config.r2);
  }
  if (config.blobBackend === "s3") {
    if (config.s3 === undefined) {
      throw new BuildDependenciesError(
        'blobBackend "s3" requires S3 config (config.s3)',
      );
    }
    return createS3BlobStore(config.s3);
  }
  return createMemoryBlobStore();
}

/** Composition root.
 *
 * Resolves the selected SQL and blob backends, builds every repository over
 * that database, and wires the MIME and mail adapters. Outbound mail is only
 * available when both a binding *and* a verified sender are present --
 * otherwise a deliberately-failing sender is installed, so the server still
 * starts (an operator can log in and finish configuring it) while every send
 * says plainly what is missing. */
export function buildDependencies(
  config: BuildDependenciesConfig,
): AppDependencies {
  const db = resolveDb(config);
  const blobs = resolveBlobs(config);

  return {
    db,
    blobs,
    clock: config.clock ?? systemClock(),
    random: config.random ?? createCryptoRandomSource(),
    tokenHasher: config.tokenHasher ?? createSha256TokenHasher(),
    mimeParser: createPostalMimeParser(),
    mimeBuilder: createMimeTextBuilder(),
    mailSender:
      config.email === undefined || config.mailFrom === undefined
        ? createUnavailableMailSender()
        : createCloudflareMailSender(config.email, config.mailFrom),

    mailDomainRepository: createMailDomainRepository(db),
    messageRepository: createMessageRepository(db),
    messageEventRepository: createMessageEventRepository(db),
    classificationRuleRepository: createClassificationRuleRepository(db),
    tagRepository: createTagRepository(db),
    apiKeyRepository: createApiKeyRepository(db),
    fileLinkRepository: createFileLinkRepository(db),
    userRepository: createUserRepository(db),
    sessionRepository: createSessionRepository(db),
    emailAuthChallengeRepository: createEmailAuthChallengeRepository(db),

    instanceConfig: {
      signupMode: config.signupMode ?? "closed",
      publicOrigin: config.publicOrigin ?? null,
      mailFrom: config.mailFrom ?? null,
      spamThreshold: config.spamThreshold ?? DEFAULT_SPAM_THRESHOLD,
      spamPhrases: config.spamPhrases ?? [],
      fileLinkMaxTtlSeconds:
        config.fileLinkMaxTtlSeconds ?? DEFAULT_FILE_LINK_MAX_TTL_SECONDS,
    },
  };
}
