import type {
  CloudflareSendEmailBinding,
  CloudflareSenderAddress,
} from "@schre/adapter/mail/cloudflare-email";
import { parseCloudflareSenderAddress } from "@schre/adapter/mail/cloudflare-email";
import type { R2BucketLike } from "@schre/adapter/blob/r2";
import type { S3Config } from "@schre/adapter/blob/s3";
import type { D1DatabaseLike } from "@schre/adapter/sql/d1";
import type { SignupMode } from "@schre/application/dependencies";
import type { DnsResolver } from "@schre/application/ports/dns-resolver";
import type {
  Clock,
  RandomSource,
  TokenHasher,
} from "@schre/application/ports/runtime-ports";

export type BlobBackend = "r2" | "s3" | "memory";
export type SqlBackend = "d1" | "sqlite";

export const DEFAULT_SQLITE_URL = "file:./data/schre.db";
export const DEFAULT_SPAM_THRESHOLD = 0.6;
export const DEFAULT_FILE_LINK_MAX_TTL_SECONDS = 604800;
const DEFAULT_S3_REGION = "us-east-1";

export interface BuildDependenciesConfig {
  readonly sqlBackend: SqlBackend;
  readonly d1?: D1DatabaseLike;
  readonly sqliteUrl?: string;
  readonly blobBackend: BlobBackend;
  readonly r2?: R2BucketLike;
  readonly s3?: S3Config;
  readonly email?: CloudflareSendEmailBinding;
  readonly mailFrom?: CloudflareSenderAddress;
  readonly publicOrigin?: string;
  readonly signupMode?: SignupMode;
  readonly spamThreshold?: number;
  readonly spamPhrases?: readonly string[];
  readonly fileLinkMaxTtlSeconds?: number;
  readonly clock?: Clock;
  readonly dns?: DnsResolver;
  readonly random?: RandomSource;
  readonly tokenHasher?: TokenHasher;
}

/** A set-but-invalid `SCHRE_PUBLIC_ORIGIN`. Thrown rather than silently
 * ignored: an operator who set the variable clearly intended login and
 * absolute file-link URLs to work, and degrading quietly would leave them
 * debugging a mail that never arrives. */
export class PublicOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicOriginConfigurationError";
  }
}

/** A sender configured without a resolvable public origin, or an invalid
 * sender address. Either combination mails links that cannot work. */
export class MailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailConfigurationError";
  }
}

type EnvLike = Record<string, string | undefined>;

/** Normalizes to scheme + host with no trailing slash. Returns `undefined`
 * for an unset variable -- which disables login rather than breaking it --
 * and throws for a set-but-unusable one. */
export function resolvePublicOrigin(env: EnvLike): string | undefined {
  const raw = env["SCHRE_PUBLIC_ORIGIN"];
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new PublicOriginConfigurationError(
      "SCHRE_PUBLIC_ORIGIN is not a valid absolute URL",
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new PublicOriginConfigurationError(
      "SCHRE_PUBLIC_ORIGIN must use http or https",
    );
  }
  return url.origin;
}

export function resolveMailFrom(
  env: EnvLike,
): CloudflareSenderAddress | undefined {
  const raw = env["SCHRE_MAIL_FROM"];
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parsed = parseCloudflareSenderAddress(raw.trim());
  if (parsed === null) {
    throw new MailConfigurationError(
      "SCHRE_MAIL_FROM is not a valid single mailbox address",
    );
  }
  return parsed;
}

/** A configured sender with no public origin would mail login links whose
 * URL cannot be built. Failing here surfaces the mistake at deploy time
 * rather than on a user's first login attempt. */
export function assertMailOriginConsistency(params: {
  readonly mailFrom: CloudflareSenderAddress | undefined;
  readonly publicOrigin: string | undefined;
}): void {
  if (params.mailFrom !== undefined && params.publicOrigin === undefined) {
    throw new MailConfigurationError(
      "SCHRE_MAIL_FROM is set but SCHRE_PUBLIC_ORIGIN is not; login links could not be built",
    );
  }
}

/** Defaults to `"closed"`. This is a mail server, not a SaaS trial: an
 * unset or unrecognized value must not leave registration open. */
export function resolveSignupMode(env: EnvLike): SignupMode {
  return env["SCHRE_SIGNUP"] === "open" ? "open" : "closed";
}

function resolveNumber(
  raw: string | undefined,
  fallback: number,
  isValid: (value: number) => boolean,
): number {
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && isValid(parsed) ? parsed : fallback;
}

export function resolveSpamThreshold(env: EnvLike): number {
  return resolveNumber(
    env["SCHRE_SPAM_THRESHOLD"],
    DEFAULT_SPAM_THRESHOLD,
    (value) => value >= 0 && value <= 1,
  );
}

/** `SCHRE_SPAM_PHRASES`: comma-separated phrases that raise the spam
 * score when matched. Blank entries are dropped. */
export function resolveSpamPhrases(env: EnvLike): readonly string[] {
  const raw = env["SCHRE_SPAM_PHRASES"];
  if (raw === undefined) {
    return [];
  }
  return raw
    .split(",")
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

export function resolveFileLinkMaxTtl(env: EnvLike): number {
  return resolveNumber(
    env["SCHRE_FILE_LINK_MAX_TTL"],
    DEFAULT_FILE_LINK_MAX_TTL_SECONDS,
    (value) => Number.isInteger(value) && value >= 60,
  );
}

/** Normalizes a SQLite location into something `@libsql/client` accepts.
 *
 * libsql requires a URL (`file:...`, `libsql://...`, `:memory:`) and throws
 * an opaque `URL_INVALID` for a bare filesystem path -- which is exactly
 * what an operator naturally writes. A plain path is therefore promoted to
 * a `file:` URL rather than being rejected. */
export function normalizeSqliteUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return DEFAULT_SQLITE_URL;
  }
  if (trimmed === ":memory:" || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }
  return `file:${trimmed}`;
}

export function resolveBlobBackend(env: EnvLike): BlobBackend {
  const raw = env["SCHRE_BLOB_BACKEND"];
  return raw === "s3" || raw === "memory" || raw === "r2" ? raw : "r2";
}

function requireS3Var(
  env: EnvLike,
  name:
    | "SCHRE_S3_ENDPOINT"
    | "SCHRE_S3_BUCKET"
    | "SCHRE_S3_ACCESS_KEY_ID"
    | "SCHRE_S3_SECRET_ACCESS_KEY",
): string {
  const value = env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`SCHRE_BLOB_BACKEND=s3 requires ${name} to be set`);
  }
  return value;
}

export function resolveS3Config(env: EnvLike): S3Config {
  return {
    endpoint: requireS3Var(env, "SCHRE_S3_ENDPOINT"),
    bucket: requireS3Var(env, "SCHRE_S3_BUCKET"),
    accessKeyId: requireS3Var(env, "SCHRE_S3_ACCESS_KEY_ID"),
    secretAccessKey: requireS3Var(env, "SCHRE_S3_SECRET_ACCESS_KEY"),
    region: env["SCHRE_S3_REGION"] ?? DEFAULT_S3_REGION,
    forcePathStyle: true,
  };
}

/** Builds the local (Bun/Node) server's config from `process.env`.
 *
 * Defaults to a libsql file plus an in-memory blob store, so a clean
 * checkout runs with no setup at all. */
export function loadConfigFromEnv(env: EnvLike): BuildDependenciesConfig {
  const publicOrigin = resolvePublicOrigin(env);
  const mailFrom = resolveMailFrom(env);
  assertMailOriginConsistency({ mailFrom, publicOrigin });

  const blobBackend = resolveBlobBackend(env);
  const localBlobBackend: BlobBackend =
    env["SCHRE_BLOB_BACKEND"] === undefined ? "memory" : blobBackend;

  return {
    sqlBackend: "sqlite",
    sqliteUrl: normalizeSqliteUrl(
      env["SCHRE_SQLITE_URL"] ?? DEFAULT_SQLITE_URL,
    ),
    blobBackend: localBlobBackend,
    ...(localBlobBackend === "s3" ? { s3: resolveS3Config(env) } : {}),
    ...(publicOrigin === undefined ? {} : { publicOrigin }),
    ...(mailFrom === undefined ? {} : { mailFrom }),
    signupMode: resolveSignupMode(env),
    spamThreshold: resolveSpamThreshold(env),
    spamPhrases: resolveSpamPhrases(env),
    fileLinkMaxTtlSeconds: resolveFileLinkMaxTtl(env),
  };
}
