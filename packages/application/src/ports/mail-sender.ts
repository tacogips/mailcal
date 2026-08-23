/** One outbound message handed to the delivery provider. */
export interface OutboundMail {
  readonly from: string;
  readonly to: readonly string[];
  readonly cc?: readonly string[];
  readonly bcc?: readonly string[];
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
  /** `X-`-prefixed custom headers, already validated by the send use case. */
  readonly headers?: ReadonlyMap<string, string>;
  /** The full RFC 5322 source, when the provider accepts a raw message. */
  readonly raw?: string;
}

/** Port over outbound delivery. Implementations: the Cloudflare Email
 * Service binding, and a deliberately-failing one used when the deployment
 * has no verified sender configured -- that failure surfaces as
 * `SERVICE_UNAVAILABLE`, which tells an operator what to fix instead of
 * masquerading as an internal error. */
export interface MailSender {
  send(mail: OutboundMail): Promise<void>;
}
