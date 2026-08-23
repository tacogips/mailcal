import { ValidationError } from "../errors";
import {
  type AddressPattern,
  matchAddressPattern,
} from "../value-objects/address-pattern";
import type { EmailAddress } from "../value-objects/email-address";
import type {
  ApiKeyId,
  ApiKeyScopeId,
  DomainId,
  UserId,
} from "../value-objects/ids";

/** Capabilities are strictly independent and never hierarchical: a key that
 * may acknowledge fetches without reading bodies is a legitimate
 * configuration, so `MAIL_MANAGE` implies nothing about `MAIL_READ`. */
export enum Capability {
  MailRead = "MAIL_READ",
  MailSend = "MAIL_SEND",
  MailManage = "MAIL_MANAGE",
  FileLink = "FILE_LINK",
  DomainAdmin = "DOMAIN_ADMIN",
  KeyAdmin = "KEY_ADMIN",
}

/** Capabilities that are instance-wide rather than per-address: they are
 * checked on the capability alone, ignoring domain and address. */
export const GLOBAL_CAPABILITIES: ReadonlySet<Capability> = new Set([
  Capability.DomainAdmin,
  Capability.KeyAdmin,
]);

export function isGlobalCapability(capability: Capability): boolean {
  return GLOBAL_CAPABILITIES.has(capability);
}

export interface ApiKeyScope {
  readonly id: ApiKeyScopeId;
  readonly apiKeyId: ApiKeyId;
  readonly capability: Capability;
  /** `null` means every managed domain. */
  readonly domainId: DomainId | null;
  readonly addressPattern: AddressPattern;
}

export interface ApiKey {
  readonly id: ApiKeyId;
  readonly name: string;
  /** SHA-256 of the entire presented secret. The plaintext is returned once,
   * from the issuing mutation, and never stored. */
  readonly keyHash: string;
  /** Non-secret display/lookup prefix, so a key can be identified and
   * revoked without the secret ever being retained. */
  readonly keyPrefix: string;
  readonly createdByUserId: UserId | null;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
}

export interface CreateApiKeyInput {
  readonly id: ApiKeyId;
  readonly name: string;
  readonly keyHash: string;
  readonly keyPrefix: string;
  readonly createdByUserId: UserId | null;
  readonly expiresAt: string | null;
  readonly createdAt: string;
}

export interface CreateApiKeyScopeInput {
  readonly id: ApiKeyScopeId;
  readonly apiKeyId: ApiKeyId;
  readonly capability: Capability;
  readonly domainId: DomainId | null;
  readonly addressPattern: AddressPattern;
}

const MAX_KEY_NAME_LENGTH = 128;

export function createApiKey(input: CreateApiKeyInput): ApiKey {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new ValidationError("api key name must not be empty", "name");
  }
  if (name.length > MAX_KEY_NAME_LENGTH) {
    throw new ValidationError(
      `api key name must be at most ${MAX_KEY_NAME_LENGTH} characters`,
      "name",
    );
  }
  if (input.keyHash.trim().length === 0) {
    throw new ValidationError("api key hash must not be empty", "keyHash");
  }
  return {
    id: input.id,
    name,
    keyHash: input.keyHash,
    keyPrefix: input.keyPrefix,
    createdByUserId: input.createdByUserId,
    createdAt: input.createdAt,
    lastUsedAt: null,
    expiresAt: input.expiresAt,
    revokedAt: null,
  };
}

export function createApiKeyScope(input: CreateApiKeyScopeInput): ApiKeyScope {
  return {
    id: input.id,
    apiKeyId: input.apiKeyId,
    capability: input.capability,
    // A global capability is meaningless per-domain, so it is always stored
    // in its canonical unrestricted form rather than with a domain the
    // check would then ignore -- which would read as a narrower grant than
    // it actually is when auditing the key.
    domainId: isGlobalCapability(input.capability) ? null : input.domainId,
    addressPattern: input.addressPattern,
  };
}

/** Revoking an already-revoked key keeps the original timestamp, so a
 * retried revocation is not a way to rewrite when it happened. */
export function revokeApiKey(key: ApiKey, revokedAt: string): ApiKey {
  return key.revokedAt === null ? { ...key, revokedAt } : key;
}

export function recordApiKeyUsage(key: ApiKey, usedAt: string): ApiKey {
  return { ...key, lastUsedAt: usedAt };
}

export function isApiKeyUsable(key: ApiKey, now: string): boolean {
  if (key.revokedAt !== null) {
    return false;
  }
  return key.expiresAt === null || key.expiresAt > now;
}

export interface ScopeMatchInput {
  readonly capability: Capability;
  readonly domainId: DomainId;
  readonly address: EmailAddress;
}

/** True when this single scope authorizes the requested operation. All
 * three conditions must hold: exact capability, domain (or a `null`
 * wildcard), and the address pattern. */
export function scopeMatches(
  scope: ApiKeyScope,
  input: ScopeMatchInput,
): boolean {
  if (scope.capability !== input.capability) {
    return false;
  }
  if (scope.domainId !== null && scope.domainId !== input.domainId) {
    return false;
  }
  return matchAddressPattern(scope.addressPattern, input.address);
}

/** True when any scope in the list authorizes the operation. */
export function scopesAuthorize(
  scopes: readonly ApiKeyScope[],
  input: ScopeMatchInput,
): boolean {
  return scopes.some((scope) => scopeMatches(scope, input));
}

/** Instance-wide check for `DOMAIN_ADMIN`/`KEY_ADMIN`: the capability alone
 * decides, ignoring domain and address. */
export function scopesAuthorizeGlobal(
  scopes: readonly ApiKeyScope[],
  capability: Capability,
): boolean {
  return scopes.some((scope) => scope.capability === capability);
}

/** Every scope in the list carrying `capability`. Used to derive the
 * address-pattern allowlist a listing query is filtered by. */
export function scopesForCapability(
  scopes: readonly ApiKeyScope[],
  capability: Capability,
): readonly ApiKeyScope[] {
  return scopes.filter((scope) => scope.capability === capability);
}
