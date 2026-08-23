import {
  type ApiKeyScope,
  Capability,
  createApiKeyScope,
} from "@yabumi/domain/entities/api-key";
import { UserRole } from "@yabumi/domain/entities/user";
import {
  type AddressPattern,
  createAddressPattern,
  MATCH_ALL_ADDRESSES,
} from "@yabumi/domain/value-objects/address-pattern";
import {
  type ApiKeyId,
  createApiKeyId,
  createApiKeyScopeId,
  createUserId,
  type DomainId,
} from "@yabumi/domain/value-objects/ids";
import type { Viewer } from "../policies/viewer";

export function adminViewer(userId = "usr-admin"): Viewer {
  return {
    kind: "USER",
    userId: createUserId(userId),
    role: UserRole.Admin,
  };
}

export function memberViewer(userId = "usr-member"): Viewer {
  return {
    kind: "USER",
    userId: createUserId(userId),
    role: UserRole.Member,
  };
}

export interface ScopeSpec {
  readonly capability: Capability;
  readonly domainId?: DomainId | null;
  readonly addressPattern?: string;
}

/** Builds a scope list with generated ids, so tests declare only what they
 * care about. */
export function buildScopes(
  apiKeyId: ApiKeyId,
  specs: readonly ScopeSpec[],
): readonly ApiKeyScope[] {
  return specs.map((spec, index) =>
    createApiKeyScope({
      id: createApiKeyScopeId(`scope-${index + 1}`),
      apiKeyId,
      capability: spec.capability,
      domainId: spec.domainId ?? null,
      addressPattern: toPattern(spec.addressPattern),
    }),
  );
}

function toPattern(value: string | undefined): AddressPattern {
  return value === undefined || value === "*"
    ? MATCH_ALL_ADDRESSES
    : createAddressPattern(value);
}

export function apiKeyViewer(
  specs: readonly ScopeSpec[],
  apiKeyIdValue = "key-1",
): Viewer {
  const apiKeyId = createApiKeyId(apiKeyIdValue);
  return { kind: "API_KEY", apiKeyId, scopes: buildScopes(apiKeyId, specs) };
}

/** A key scoped to exactly one mailbox, with the four per-address
 * capabilities -- the support-desk agent from the design doc. */
export function mailboxAgentViewer(
  domainId: DomainId,
  address: string,
  apiKeyIdValue = "key-agent",
): Viewer {
  return apiKeyViewer(
    [
      { capability: Capability.MailRead, domainId, addressPattern: address },
      { capability: Capability.MailSend, domainId, addressPattern: address },
      { capability: Capability.MailManage, domainId, addressPattern: address },
      { capability: Capability.FileLink, domainId, addressPattern: address },
    ],
    apiKeyIdValue,
  );
}
