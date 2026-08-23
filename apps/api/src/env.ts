import type { R2BucketLike } from "@yabumi/adapter/blob/r2";
import type { CloudflareSendEmailBinding } from "@yabumi/adapter/mail/cloudflare-email";
import type { D1DatabaseLike } from "@yabumi/adapter/sql/d1";

/** Minimal structural surface of the Workers Static Assets binding, used by
 * `worker.ts`'s SPA fallthrough. Kept local (see `D1DatabaseLike` and
 * `R2BucketLike` for the same rationale) rather than importing the
 * ambient-global `@cloudflare/workers-types`. */
export interface FetcherLike {
  fetch(request: Request): Promise<Response>;
}

/** Minimal structural surface of a Workers `ExecutionContext`.
 *
 * Forwarded to `app.fetch(request, env, ctx)`, which makes it available as
 * hono's `c.executionCtx` -- used by the auth middleware's once-per-isolate
 * expiry sweep, so the runtime does not cancel that fire-and-forget cleanup
 * once the response is returned. */
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  /** Present for structural compatibility with hono's own `ExecutionContext`
   * type; yabumi never reads it. */
  readonly props: unknown;
}

/** Cloudflare Email Routing's inbound message, as a local structural type.
 *
 * `to` is the SMTP envelope recipient -- the address that actually caused
 * delivery -- which is what the ingest pipeline resolves the domain from and
 * what API key scopes are matched against. */
export interface ForwardableEmailMessageLike {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

/** Workers bindings and vars, matching `wrangler.toml`. */
export interface Env {
  readonly DB: D1DatabaseLike;
  readonly BLOB: R2BucketLike;
  readonly ASSETS: FetcherLike;
  readonly EMAIL: CloudflareSendEmailBinding;
  readonly YABUMI_PUBLIC_ORIGIN?: string;
  readonly YABUMI_MAIL_FROM?: string;
  readonly YABUMI_SIGNUP?: string;
  readonly YABUMI_SPAM_THRESHOLD?: string;
  readonly YABUMI_SPAM_PHRASES?: string;
  readonly YABUMI_FILE_LINK_MAX_TTL?: string;
  readonly YABUMI_BLOB_BACKEND?: string;
  readonly YABUMI_S3_ENDPOINT?: string;
  readonly YABUMI_S3_BUCKET?: string;
  readonly YABUMI_S3_ACCESS_KEY_ID?: string;
  readonly YABUMI_S3_SECRET_ACCESS_KEY?: string;
  readonly YABUMI_S3_REGION?: string;
}

/** Workers vars arrive on the `Env` object rather than in `process.env`, so
 * the shared `composition/config.ts` resolvers -- which take a plain
 * string map -- are fed through this. */
export function envToRecord(env: Env): Record<string, string | undefined> {
  return {
    YABUMI_PUBLIC_ORIGIN: env.YABUMI_PUBLIC_ORIGIN,
    YABUMI_MAIL_FROM: env.YABUMI_MAIL_FROM,
    YABUMI_SIGNUP: env.YABUMI_SIGNUP,
    YABUMI_SPAM_THRESHOLD: env.YABUMI_SPAM_THRESHOLD,
    YABUMI_SPAM_PHRASES: env.YABUMI_SPAM_PHRASES,
    YABUMI_FILE_LINK_MAX_TTL: env.YABUMI_FILE_LINK_MAX_TTL,
    YABUMI_BLOB_BACKEND: env.YABUMI_BLOB_BACKEND,
    YABUMI_S3_ENDPOINT: env.YABUMI_S3_ENDPOINT,
    YABUMI_S3_BUCKET: env.YABUMI_S3_BUCKET,
    YABUMI_S3_ACCESS_KEY_ID: env.YABUMI_S3_ACCESS_KEY_ID,
    YABUMI_S3_SECRET_ACCESS_KEY: env.YABUMI_S3_SECRET_ACCESS_KEY,
    YABUMI_S3_REGION: env.YABUMI_S3_REGION,
  };
}

/** Flattens Workers `Headers` into the lower-cased map the ingest use case
 * reads spam signals from. */
export function headersToMap(headers: Headers): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    const existing = map.get(lower);
    map.set(lower, existing === undefined ? value : `${existing}, ${value}`);
  });
  return map;
}
