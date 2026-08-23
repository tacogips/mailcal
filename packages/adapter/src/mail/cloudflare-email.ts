import type {
  MailSender,
  OutboundMail,
} from "@mailcal/application/ports/mail-sender";

const GENERIC_DELIVERY_ERROR = "Email delivery is unavailable";
const LOCAL_PART_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;
const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

declare const cloudflareSenderAddressBrand: unique symbol;

/** One canonical plain mailbox accepted by the Workers email binding. */
export type CloudflareSenderAddress = string & {
  readonly [cloudflareSenderAddressBrand]: true;
};

/** Parses one ASCII mailbox with no display-name or address-list syntax.
 * Kept separate from the domain layer's `EmailAddress` because this is a
 * *provider* constraint: the binding rejects anything else, and finding
 * that out at send time would surface as an opaque failure. */
export function parseCloudflareSenderAddress(
  value: string,
): CloudflareSenderAddress | null {
  if (
    value.length > 254 ||
    value !== value.trim() ||
    !/^[\x21-\x7e]+$/.test(value)
  ) {
    return null;
  }
  const parts = value.split("@");
  if (parts.length !== 2) {
    return null;
  }
  const local = parts[0];
  const domain = parts[1];
  if (
    local === undefined ||
    domain === undefined ||
    local.length === 0 ||
    local.length > 64 ||
    !LOCAL_PART_PATTERN.test(local) ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    domain.length === 0 ||
    domain.length > 253
  ) {
    return null;
  }
  const labels = domain.split(".");
  if (
    labels.length < 2 ||
    labels.some((label) => !DOMAIN_LABEL_PATTERN.test(label))
  ) {
    return null;
  }
  return value.toLowerCase() as CloudflareSenderAddress;
}

/** Structured message accepted by Cloudflare Email Service's Workers
 * binding. `to` is a single recipient -- see the fan-out in
 * {@link createCloudflareMailSender}. */
export interface CloudflareEmailMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface CloudflareEmailSendResult {
  readonly messageId?: string;
}

/** Minimal structural Workers binding, avoiding an ambient runtime
 * dependency (see the local types in `../sql/d1.ts` for the same rationale). */
export interface CloudflareSendEmailBinding {
  send(message: CloudflareEmailMessage): Promise<CloudflareEmailSendResult>;
}

/** Carries no provider detail and no message content on purpose.
 *
 * A mail provider's error text routinely echoes recipient addresses and
 * subjects, and this error reaches API clients -- including agents scoped to
 * a single mailbox, which must not learn about other recipients from a
 * failure message. */
export class MailDeliveryError extends Error {
  constructor() {
    super(GENERIC_DELIVERY_ERROR);
    this.name = "MailDeliveryError";
  }
}

/** Cloudflare Email Service adapter for the native Workers `send_email`
 * binding.
 *
 * The binding takes exactly one recipient per call, so a multi-recipient
 * `OutboundMail` is fanned out. Delivery is therefore not atomic across
 * recipients: a failure partway through leaves earlier recipients delivered,
 * which is why the send use case records the message as `FAILED` and lets an
 * operator decide whether to retry rather than silently re-sending. */
export function createCloudflareMailSender(
  binding: CloudflareSendEmailBinding,
  from: CloudflareSenderAddress,
): MailSender {
  return {
    async send(mail: OutboundMail): Promise<void> {
      const recipients = [...mail.to, ...(mail.cc ?? []), ...(mail.bcc ?? [])];
      const headers =
        mail.headers === undefined
          ? undefined
          : Object.fromEntries(mail.headers);
      for (const recipient of recipients) {
        try {
          await binding.send({
            from,
            to: recipient,
            subject: mail.subject,
            text: mail.text,
            ...(mail.html === undefined ? {} : { html: mail.html }),
            ...(headers === undefined ? {} : { headers }),
          });
        } catch {
          throw new MailDeliveryError();
        }
      }
    },
  };
}

/** Deferred failure used when the deployment has no verified sender, or is
 * running outside Workers. Failing here -- rather than at configuration
 * time -- keeps the server startable so an operator can log in and finish
 * setting it up, while every send attempt says plainly what is missing. */
export function createUnavailableMailSender(): MailSender {
  return {
    async send(): Promise<void> {
      throw new MailDeliveryError();
    },
  };
}
