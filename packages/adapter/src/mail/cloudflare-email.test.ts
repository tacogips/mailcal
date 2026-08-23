import type { OutboundMail } from "@mailcal/application/ports/mail-sender";
import { describe, expect, test } from "vitest";
import {
  type CloudflareEmailMessage,
  type CloudflareSendEmailBinding,
  createCloudflareMailSender,
  createUnavailableMailSender,
  MailDeliveryError,
  parseCloudflareSenderAddress,
} from "./cloudflare-email";

function recordingBinding(options?: { failOn?: string }): {
  binding: CloudflareSendEmailBinding;
  sent: CloudflareEmailMessage[];
} {
  const sent: CloudflareEmailMessage[] = [];
  return {
    sent,
    binding: {
      async send(message) {
        if (options?.failOn === message.to) {
          throw new Error(
            `provider rejected ${message.to} for subject "${message.subject}"`,
          );
        }
        sent.push(message);
        return {};
      },
    },
  };
}

const from = parseCloudflareSenderAddress("noreply@example.com");
if (from === null) {
  throw new Error("fixture sender address must be valid");
}

const mail: OutboundMail = {
  from: "noreply@example.com",
  to: ["a@other.com", "b@other.com"],
  cc: ["c@other.com"],
  subject: "Hello",
  text: "Body",
};

describe("parseCloudflareSenderAddress", () => {
  test.each([
    ["noreply@example.com", "noreply@example.com"],
    ["NoReply@Example.COM", "noreply@example.com"],
    ["a.b+c@mail.example.co.jp", "a.b+c@mail.example.co.jp"],
  ])("accepts %j", (input, expected) => {
    expect(parseCloudflareSenderAddress(input)).toBe(expected);
  });

  test.each([
    ["a display name form", "Name <a@example.com>"],
    ["no at sign", "nobody"],
    ["two at signs", "a@b@example.com"],
    ["a single-label domain", "a@localhost"],
    ["leading whitespace", " a@example.com"],
    ["a double dot", "a..b@example.com"],
    ["an empty local part", "@example.com"],
  ])("rejects %s", (_label, input) => {
    expect(parseCloudflareSenderAddress(input)).toBeNull();
  });
});

describe("createCloudflareMailSender", () => {
  test("fans out one binding call per recipient", async () => {
    const { binding, sent } = recordingBinding();
    await createCloudflareMailSender(binding, from).send(mail);

    expect(sent.map((message) => message.to)).toEqual([
      "a@other.com",
      "b@other.com",
      "c@other.com",
    ]);
    expect(
      sent.every((message) => message.from === "noreply@example.com"),
    ).toBe(true);
  });

  test("uses the configured sender, ignoring the mail's own from", async () => {
    const { binding, sent } = recordingBinding();
    await createCloudflareMailSender(binding, from).send({
      ...mail,
      from: "spoofed@evil.com",
      to: ["a@other.com"],
      cc: [],
    });
    expect(sent[0]?.from).toBe("noreply@example.com");
  });

  test("passes custom headers through", async () => {
    const { binding, sent } = recordingBinding();
    await createCloudflareMailSender(binding, from).send({
      ...mail,
      to: ["a@other.com"],
      cc: [],
      headers: new Map([["X-Campaign-Id", "abc"]]),
    });
    expect(sent[0]?.headers).toEqual({ "X-Campaign-Id": "abc" });
  });

  test("masks a provider failure, leaking no recipient or subject", async () => {
    const { binding } = recordingBinding({ failOn: "b@other.com" });
    const sender = createCloudflareMailSender(binding, from);

    await expect(sender.send(mail)).rejects.toBeInstanceOf(MailDeliveryError);
    try {
      await sender.send(mail);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toBe("Email delivery is unavailable");
      expect(message).not.toContain("b@other.com");
      expect(message).not.toContain("Hello");
    }
  });
});

describe("createUnavailableMailSender", () => {
  test("always fails with the same masked error", async () => {
    await expect(
      createUnavailableMailSender().send(mail),
    ).rejects.toBeInstanceOf(MailDeliveryError);
  });
});
