import {
  type Capability,
  isGlobalCapability,
  scopesAuthorize,
  scopesAuthorizeGlobal,
  scopesForCapability,
} from "@yabumi/domain/entities/api-key";
import type { AddressPattern } from "@yabumi/domain/value-objects/address-pattern";
import type { EmailAddress } from "@yabumi/domain/value-objects/email-address";
import type { DomainId } from "@yabumi/domain/value-objects/ids";
import { ForbiddenError, UnauthenticatedError } from "../errors";
import { isAdminViewer, type Viewer } from "./viewer";

/** Every authorization decision in yabumi goes through this module. Use
 * cases call it rather than inspecting `Viewer` directly, so the rules exist
 * in exactly one place and can be audited as a unit. */

/** Narrows a possibly-absent viewer, throwing `UnauthenticatedError`. */
export function requireViewer(viewer: Viewer | null): Viewer {
  if (viewer === null) {
    throw new UnauthenticatedError("Authentication required");
  }
  return viewer;
}

/** Non-throwing form of {@link requireGlobalCapability}. */
export function authorizesGlobal(
  viewer: Viewer,
  capability: Capability,
): boolean {
  if (viewer.kind === "USER") {
    // Instance administration is an ADMIN-only user power; a MEMBER never
    // has it, and a deactivated user never resolves to a viewer at all.
    return isGlobalCapability(capability)
      ? isAdminViewer(viewer)
      : // Non-global capabilities are per-address; asking about them here is
        // a caller mistake rather than a grant, so answer conservatively.
        false;
  }
  return scopesAuthorizeGlobal(viewer.scopes, capability);
}

/** Instance-wide capability check (`DOMAIN_ADMIN`, `KEY_ADMIN`). */
export function requireGlobalCapability(
  viewer: Viewer,
  capability: Capability,
): void {
  if (!authorizesGlobal(viewer, capability)) {
    throw new ForbiddenError(
      `This credential is not permitted to perform ${capability} operations`,
    );
  }
}

/** Non-throwing per-address check. Passes when **any** of `addresses` is
 * authorized: a message with several envelope recipients is readable when
 * the key covers even one of them. */
export function authorizesAnyAddress(
  viewer: Viewer,
  capability: Capability,
  domainId: DomainId,
  addresses: readonly EmailAddress[],
): boolean {
  if (viewer.kind === "USER") {
    // Both ADMIN and MEMBER users may read, send and manage mail across
    // every managed domain; only instance administration distinguishes
    // them (see `authorizesGlobal`).
    return !isGlobalCapability(capability);
  }
  return addresses.some((address) =>
    scopesAuthorize(viewer.scopes, { capability, domainId, address }),
  );
}

/** Throwing per-address check, for write operations. Reads must **not** use
 * this: an unauthorized read is reported as `NOT_FOUND` by its use case, so
 * a key cannot probe for the existence of addresses outside its scope. */
export function requireAddressCapability(
  viewer: Viewer,
  capability: Capability,
  domainId: DomainId,
  addresses: readonly EmailAddress[],
): void {
  if (!authorizesAnyAddress(viewer, capability, domainId, addresses)) {
    throw new ForbiddenError(
      `This credential is not permitted to perform ${capability} on the requested address`,
    );
  }
}

/** The address patterns a listing query must be filtered by.
 *
 * `null` means unrestricted (a user viewer). An **empty array** means the
 * viewer holds no scope for this capability at all and must therefore see
 * nothing -- callers and the repository must treat that as "match none",
 * never as "no filter". */
export function readableAddressPatterns(
  viewer: Viewer,
  capability: Capability,
): readonly AddressPattern[] | null {
  if (viewer.kind === "USER") {
    return null;
  }
  return scopesForCapability(viewer.scopes, capability).map(
    (scope) => scope.addressPattern,
  );
}

/** The domain ids a listing query must be restricted to, or `null` for
 * unrestricted. A scope with a `null` `domainId` is a wildcard, so the
 * presence of even one collapses the whole result to `null`. */
export function scopedDomainIds(
  viewer: Viewer,
  capability: Capability,
): readonly DomainId[] | null {
  if (viewer.kind === "USER") {
    return null;
  }
  const scopes = scopesForCapability(viewer.scopes, capability);
  if (scopes.length === 0) {
    // No scope for this capability: nothing is visible. Signalled as an
    // empty array rather than `null`, which would mean "everything".
    return [];
  }
  const ids: DomainId[] = [];
  for (const scope of scopes) {
    if (scope.domainId === null) {
      return null;
    }
    if (!ids.includes(scope.domainId)) {
      ids.push(scope.domainId);
    }
  }
  return ids;
}
