import type { Viewer } from "@mailcal/application/policies";
import { Capability } from "@mailcal/domain/entities/api-key";
import { UserRole } from "@mailcal/domain/entities/user";
import type { GraphQLContext } from "../context";
import { unauthenticatedError } from "../errors";

/** Narrows the context's viewer or throws `UNAUTHENTICATED`. Every
 * protected resolver starts here. */
export function requireViewerOrThrow(ctx: GraphQLContext): Viewer {
  if (ctx.viewer === null) {
    throw unauthenticatedError();
  }
  return ctx.viewer;
}

/** The capabilities a viewer's *role* may exercise at all, for
 * `Viewer.capabilities` -- mirroring `policies/authorization.ts`'s
 * `roleGrantsCapability`, not the address-scoped ALLOW/DENY rules
 * underneath it. This is a role-level ceiling, so it does not shrink to
 * "empty" for a MEMBER/VIEWER with no mailbox rules yet: the client uses it
 * to decide which UI to show, not to predict a specific mailbox's outcome.
 *
 * ADMIN holds every mail capability plus instance administration. MEMBER
 * holds every non-global mail capability. VIEWER holds only MAIL_READ and
 * FILE_LINK -- it can never send or mutate mail, regardless of its rules. */
export function viewerCapabilities(viewer: Viewer): readonly Capability[] {
  if (viewer.kind === "USER") {
    if (viewer.role === UserRole.Viewer) {
      return [Capability.MailRead, Capability.FileLink];
    }
    const mail = [
      Capability.MailRead,
      Capability.MailSend,
      Capability.MailManage,
      Capability.FileLink,
    ];
    return viewer.role === UserRole.Admin
      ? [...mail, Capability.DomainAdmin, Capability.KeyAdmin]
      : mail;
  }
  const held = new Set<Capability>();
  for (const scope of viewer.scopes) {
    held.add(scope.capability);
  }
  return [...held];
}

export function holdsCapability(
  viewer: Viewer,
  capability: Capability,
): boolean {
  return viewerCapabilities(viewer).includes(capability);
}
