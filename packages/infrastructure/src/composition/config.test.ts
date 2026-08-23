import { describe, expect, test } from "vitest";
import {
  buildDependencies,
  BuildDependenciesError,
} from "./build-dependencies";
import {
  assertMailOriginConsistency,
  DEFAULT_FILE_LINK_MAX_TTL_SECONDS,
  DEFAULT_SPAM_THRESHOLD,
  loadConfigFromEnv,
  MailConfigurationError,
  PublicOriginConfigurationError,
  resolveBlobBackend,
  resolveFileLinkMaxTtl,
  normalizeSqliteUrl,
  resolveMailFrom,
  resolvePublicOrigin,
  resolveSignupMode,
  resolveSpamThreshold,
} from "./config";

describe("resolvePublicOrigin", () => {
  test("normalizes to scheme and host", () => {
    expect(
      resolvePublicOrigin({
        SCHRE_PUBLIC_ORIGIN: "https://mail.example.com/some/path/",
      }),
    ).toBe("https://mail.example.com");
  });

  test.each([
    ["unset", {}],
    ["empty", { SCHRE_PUBLIC_ORIGIN: "" }],
    ["whitespace", { SCHRE_PUBLIC_ORIGIN: "   " }],
  ])("is undefined when %s", (_label, env) => {
    expect(resolvePublicOrigin(env)).toBeUndefined();
  });

  test.each([
    ["not a url", "mail.example.com"],
    ["an unsupported scheme", "ftp://mail.example.com"],
  ])("throws for %s", (_label, value) => {
    expect(() => resolvePublicOrigin({ SCHRE_PUBLIC_ORIGIN: value })).toThrow(
      PublicOriginConfigurationError,
    );
  });
});

describe("resolveMailFrom", () => {
  test("accepts a normalized mailbox", () => {
    expect(
      resolveMailFrom({ SCHRE_MAIL_FROM: " PostMaster@Example.com " }),
    ).toBe("postmaster@example.com");
  });

  test("is undefined when unset", () => {
    expect(resolveMailFrom({})).toBeUndefined();
  });

  test.each(["Name <a@example.com>", "nobody", "a@localhost"])(
    "throws for %j",
    (value) => {
      expect(() => resolveMailFrom({ SCHRE_MAIL_FROM: value })).toThrow(
        MailConfigurationError,
      );
    },
  );
});

describe("assertMailOriginConsistency", () => {
  test("rejects a sender with no public origin", () => {
    expect(() =>
      assertMailOriginConsistency({
        mailFrom: "a@example.com" as never,
        publicOrigin: undefined,
      }),
    ).toThrow(MailConfigurationError);
  });

  test.each([
    ["both set", "a@example.com", "https://mail.example.com"],
    ["neither set", undefined, undefined],
    ["only an origin", undefined, "https://mail.example.com"],
  ])("accepts %s", (_label, mailFrom, publicOrigin) => {
    expect(() =>
      assertMailOriginConsistency({
        mailFrom: mailFrom as never,
        publicOrigin,
      }),
    ).not.toThrow();
  });
});

describe("scalar env resolution", () => {
  test("signup defaults closed", () => {
    expect(resolveSignupMode({})).toBe("closed");
    expect(resolveSignupMode({ SCHRE_SIGNUP: "yes" })).toBe("closed");
    expect(resolveSignupMode({ SCHRE_SIGNUP: "open" })).toBe("open");
  });

  test("spam threshold falls back for anything out of range", () => {
    expect(resolveSpamThreshold({})).toBe(DEFAULT_SPAM_THRESHOLD);
    expect(resolveSpamThreshold({ SCHRE_SPAM_THRESHOLD: "0.8" })).toBe(0.8);
    expect(resolveSpamThreshold({ SCHRE_SPAM_THRESHOLD: "0" })).toBe(0);
    for (const bad of ["-1", "2", "nonsense", ""]) {
      expect(resolveSpamThreshold({ SCHRE_SPAM_THRESHOLD: bad })).toBe(
        DEFAULT_SPAM_THRESHOLD,
      );
    }
  });

  test("file link ttl falls back for anything below the floor", () => {
    expect(resolveFileLinkMaxTtl({})).toBe(DEFAULT_FILE_LINK_MAX_TTL_SECONDS);
    expect(resolveFileLinkMaxTtl({ SCHRE_FILE_LINK_MAX_TTL: "3600" })).toBe(
      3600,
    );
    for (const bad of ["10", "1.5", "nope"]) {
      expect(resolveFileLinkMaxTtl({ SCHRE_FILE_LINK_MAX_TTL: bad })).toBe(
        DEFAULT_FILE_LINK_MAX_TTL_SECONDS,
      );
    }
  });

  test("blob backend defaults to r2", () => {
    expect(resolveBlobBackend({})).toBe("r2");
    expect(resolveBlobBackend({ SCHRE_BLOB_BACKEND: "s3" })).toBe("s3");
    expect(resolveBlobBackend({ SCHRE_BLOB_BACKEND: "memory" })).toBe("memory");
    expect(resolveBlobBackend({ SCHRE_BLOB_BACKEND: "nonsense" })).toBe("r2");
  });
});

describe("normalizeSqliteUrl", () => {
  test.each([
    // A bare path is what an operator naturally writes; libsql rejects it
    // with an opaque URL_INVALID, so it is promoted rather than refused.
    ["/tmp/schre.db", "file:/tmp/schre.db"],
    ["./data/schre.db", "file:./data/schre.db"],
    ["schre.db", "file:schre.db"],
  ])("promotes the bare path %j to %j", (input, expected) => {
    expect(normalizeSqliteUrl(input)).toBe(expected);
  });

  test.each([
    ":memory:",
    "file:./data/schre.db",
    "libsql://example.turso.io",
    "https://example.turso.io",
  ])("leaves %j untouched", (value) => {
    expect(normalizeSqliteUrl(value)).toBe(value);
  });

  test("falls back to the default for a blank value", () => {
    expect(normalizeSqliteUrl("   ")).toBe("file:./data/schre.db");
  });
});

describe("loadConfigFromEnv", () => {
  test("a bare environment yields a runnable local config", () => {
    const config = loadConfigFromEnv({});
    expect(config.sqlBackend).toBe("sqlite");
    expect(config.sqliteUrl).toBe("file:./data/schre.db");
    // Local defaults to memory blobs so a clean checkout runs with no setup.
    expect(config.blobBackend).toBe("memory");
    expect(config.signupMode).toBe("closed");
  });

  test("normalizes a bare sqlite path from the environment", () => {
    expect(
      loadConfigFromEnv({ SCHRE_SQLITE_URL: "/tmp/schre.db" }).sqliteUrl,
    ).toBe("file:/tmp/schre.db");
  });

  test("honours an explicit s3 backend", () => {
    const config = loadConfigFromEnv({
      SCHRE_BLOB_BACKEND: "s3",
      SCHRE_S3_ENDPOINT: "http://localhost:9000",
      SCHRE_S3_BUCKET: "schre",
      SCHRE_S3_ACCESS_KEY_ID: "key",
      SCHRE_S3_SECRET_ACCESS_KEY: "secret",
    });
    expect(config.blobBackend).toBe("s3");
    expect(config.s3?.bucket).toBe("schre");
    expect(config.s3?.forcePathStyle).toBe(true);
  });

  test("an s3 backend missing a credential fails fast", () => {
    expect(() => loadConfigFromEnv({ SCHRE_BLOB_BACKEND: "s3" })).toThrow(
      /SCHRE_S3_ENDPOINT/,
    );
  });
});

describe("buildDependencies", () => {
  test("assembles a working in-memory instance", () => {
    const deps = buildDependencies({
      sqlBackend: "sqlite",
      sqliteUrl: ":memory:",
      blobBackend: "memory",
    });
    expect(deps.messageRepository).toBeDefined();
    expect(deps.mimeParser).toBeDefined();
    expect(deps.instanceConfig.signupMode).toBe("closed");
    expect(deps.instanceConfig.publicOrigin).toBeNull();
    expect(deps.instanceConfig.spamThreshold).toBe(DEFAULT_SPAM_THRESHOLD);
  });

  test("installs the unavailable mail sender without a verified sender", async () => {
    const deps = buildDependencies({
      sqlBackend: "sqlite",
      sqliteUrl: ":memory:",
      blobBackend: "memory",
    });
    await expect(
      deps.mailSender.send({
        from: "a@example.com",
        to: ["b@example.com"],
        subject: "x",
        text: "y",
      }),
    ).rejects.toThrow(/Email delivery is unavailable/);
  });

  test("uses the Cloudflare sender when both binding and sender exist", async () => {
    const sent: unknown[] = [];
    const deps = buildDependencies({
      sqlBackend: "sqlite",
      sqliteUrl: ":memory:",
      blobBackend: "memory",
      email: {
        async send(message) {
          sent.push(message);
          return {};
        },
      },
      mailFrom: "postmaster@example.com" as never,
      publicOrigin: "https://mail.example.com",
    });
    await deps.mailSender.send({
      from: "ignored@example.com",
      to: ["b@example.com"],
      subject: "x",
      text: "y",
    });
    expect(sent).toHaveLength(1);
  });

  test.each([
    [
      "d1 without a binding",
      { sqlBackend: "d1" as const, blobBackend: "memory" as const },
    ],
    [
      "r2 without a binding",
      {
        sqlBackend: "sqlite" as const,
        sqliteUrl: ":memory:",
        blobBackend: "r2" as const,
      },
    ],
    [
      "s3 without config",
      {
        sqlBackend: "sqlite" as const,
        sqliteUrl: ":memory:",
        blobBackend: "s3" as const,
      },
    ],
  ])("throws for %s", (_label, config) => {
    expect(() => buildDependencies(config)).toThrow(BuildDependenciesError);
  });
});
