import type { Viewer } from "@yabumi/application/policies";
import { Capability } from "@yabumi/domain/entities/api-key";
import { UserRole } from "@yabumi/domain/entities/user";
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

/** The capabilities a viewer effectively holds, for `Viewer.capabilities`.
 *
 * A user's set is derived from its role rather than stored, mirroring
 * `policies/authorization.ts`: both roles may work with mail, only an admin
 * may administer the instance. */
export function viewerCapabilities(viewer: Viewer): readonly Capability[] {
  if (viewer.kind === "USER") {
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
