import { Capability } from "@yabumi/domain/entities/api-key";
import { createEmailAddress } from "@yabumi/domain/value-objects/email-address";
import { createDomainId } from "@yabumi/domain/value-objects/ids";
import { describe, expect, test } from "vitest";
import { ForbiddenError, UnauthenticatedError } from "../errors";
import {
  adminViewer,
  apiKeyViewer,
  memberViewer,
} from "../test-support/viewer-fixtures";
import {
  authorizesAnyAddress,
  authorizesGlobal,
  readableAddressPatterns,
  requireAddressCapability,
  requireGlobalCapability,
  requireViewer,
  scopedDomainIds,
} from "./authorization";

const domainA = createDomainId("dom-a");
const domainB = createDomainId("dom-b");
const support = createEmailAddress("support@example.com");
const billing = createEmailAddress("billing@example.com");

describe("requireViewer", () => {
  test("throws for a null viewer", () => {
    expect(() => requireViewer(null)).toThrow(UnauthenticatedError);
  });

  test("returns the viewer unchanged", () => {
    const viewer = adminViewer();
    expect(requireViewer(viewer)).toBe(viewer);
  });
});

describe("global capabilities", () => {
  test("an ADMIN user holds them", () => {
    expect(authorizesGlobal(adminViewer(), Capability.DomainAdmin)).toBe(true);
    expect(authorizesGlobal(adminViewer(), Capability.KeyAdmin)).toBe(true);
  });

  test("a MEMBER user never holds them", () => {
    expect(authorizesGlobal(memberViewer(), Capability.DomainAdmin)).toBe(
      false,
    );
    expect(() =>
      requireGlobalCapability(memberViewer(), Capability.KeyAdmin),
    ).toThrow(ForbiddenError);
  });

  test("an api key holds only what its scopes grant, without inheritance", () => {
    const viewer = apiKeyViewer([{ capability: Capability.KeyAdmin }]);
    expect(authorizesGlobal(viewer, Capability.KeyAdmin)).toBe(true);
    expect(authorizesGlobal(viewer, Capability.DomainAdmin)).toBe(false);
  });

  test("an unscoped api key holds nothing", () => {
    const viewer = apiKeyViewer([]);
    expect(authorizesGlobal(viewer, Capability.KeyAdmin)).toBe(false);
  });
});

describe("per-address capabilities", () => {
  const scopedViewer = apiKeyViewer([
    {
      capability: Capability.MailRead,
      domainId: domainA,
      addressPattern: "support@example.com",
    },
  ]);

  test("both user roles may act on mail across every domain", () => {
    for (const viewer of [adminViewer(), memberViewer()]) {
      expect(
        authorizesAnyAddress(viewer, Capability.MailRead, domainB, [billing]),
      ).toBe(true);
      expect(
        authorizesAnyAddress(viewer, Capability.MailSend, domainB, [billing]),
      ).toBe(true);
    }
  });

  test("a scoped key matches only its own address", () => {
    expect(
      authorizesAnyAddress(scopedViewer, Capability.MailRead, domainA, [
        support,
      ]),
    ).toBe(true);
    expect(
      authorizesAnyAddress(scopedViewer, Capability.MailRead, domainA, [
        billing,
      ]),
    ).toBe(false);
  });

  test("a scoped key does not cross domains", () => {
    expect(
      authorizesAnyAddress(scopedViewer, Capability.MailRead, domainB, [
        support,
      ]),
    ).toBe(false);
  });

  test("capabilities do not imply one another", () => {
    expect(
      authorizesAnyAddress(scopedViewer, Capability.MailManage, domainA, [
        support,
      ]),
    ).toBe(false);
  });

  test("any one authorized address in the list is enough", () => {
    expect(
      authorizesAnyAddress(scopedViewer, Capability.MailRead, domainA, [
        billing,
        support,
      ]),
    ).toBe(true);
  });

  test("an empty address list authorizes nothing for a key", () => {
    expect(
      authorizesAnyAddress(scopedViewer, Capability.MailRead, domainA, []),
    ).toBe(false);
  });

  test("requireAddressCapability throws for a denied key", () => {
    expect(() =>
      requireAddressCapability(scopedViewer, Capability.MailRead, domainA, [
        billing,
      ]),
    ).toThrow(ForbiddenError);
  });

  test("a user viewer never passes a global capability through the address check", () => {
    expect(
      authorizesAnyAddress(adminViewer(), Capability.KeyAdmin, domainA, [
        support,
      ]),
    ).toBe(false);
  });
});

describe("readableAddressPatterns", () => {
  test("is null (unrestricted) for user viewers", () => {
    expect(
      readableAddressPatterns(adminViewer(), Capability.MailRead),
    ).toBeNull();
    expect(
      readableAddressPatterns(memberViewer(), Capability.MailRead),
    ).toBeNull();
  });

  test("collects the patterns of matching scopes only", () => {
    const viewer = apiKeyViewer([
      {
        capability: Capability.MailRead,
        domainId: domainA,
        addressPattern: "support@example.com",
      },
      {
        capability: Capability.MailRead,
        domainId: domainA,
        addressPattern: "*@other.com",
      },
      {
        capability: Capability.MailSend,
        domainId: domainA,
        addressPattern: "noreply@example.com",
      },
    ]);
    expect(readableAddressPatterns(viewer, Capability.MailRead)).toEqual([
      "support@example.com",
      "*@other.com",
    ]);
  });

  test("is an empty array (match nothing) when the key holds no such scope", () => {
    const viewer = apiKeyViewer([{ capability: Capability.MailSend }]);
    expect(readableAddressPatterns(viewer, Capability.MailRead)).toEqual([]);
  });
});

describe("scopedDomainIds", () => {
  test("is null for user viewers", () => {
    expect(scopedDomainIds(adminViewer(), Capability.MailRead)).toBeNull();
  });

  test("is null when any scope is a domain wildcard", () => {
    const viewer = apiKeyViewer([
      { capability: Capability.MailRead, domainId: domainA },
      { capability: Capability.MailRead, domainId: null },
    ]);
    expect(scopedDomainIds(viewer, Capability.MailRead)).toBeNull();
  });

  test("deduplicates the concrete domain ids", () => {
    const viewer = apiKeyViewer([
      { capability: Capability.MailRead, domainId: domainA },
      { capability: Capability.MailRead, domainId: domainA },
      { capability: Capability.MailRead, domainId: domainB },
    ]);
    expect(scopedDomainIds(viewer, Capability.MailRead)).toEqual([
      domainA,
      domainB,
    ]);
  });

  test("is an empty array when the key holds no such scope", () => {
    const viewer = apiKeyViewer([{ capability: Capability.MailSend }]);
    expect(scopedDomainIds(viewer, Capability.MailRead)).toEqual([]);
  });
});
