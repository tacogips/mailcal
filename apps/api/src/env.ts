import type { R2BucketLike } from "@schre/adapter/blob/r2";
import type { CloudflareSendEmailBinding } from "@schre/adapter/mail/cloudflare-email";
import type { D1DatabaseLike } from "@schre/adapter/sql/d1";

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
   * type; schre never reads it. */
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
  readonly SCHRE_PUBLIC_ORIGIN?: string;
  readonly SCHRE_MAIL_FROM?: string;
  readonly SCHRE_SIGNUP?: string;
  readonly SCHRE_SPAM_THRESHOLD?: string;
  readonly SCHRE_SPAM_PHRASES?: string;
  readonly SCHRE_FILE_LINK_MAX_TTL?: string;
  readonly SCHRE_BLOB_BACKEND?: string;
  readonly SCHRE_S3_ENDPOINT?: string;
  readonly SCHRE_S3_BUCKET?: string;
  readonly SCHRE_S3_ACCESS_KEY_ID?: string;
  readonly SCHRE_S3_SECRET_ACCESS_KEY?: string;
  readonly SCHRE_S3_REGION?: string;
}

/** Workers vars arrive on the `Env` object rather than in `process.env`, so
 * the shared `composition/config.ts` resolvers -- which take a plain
 * string map -- are fed through this. */
export function envToRecord(env: Env): Record<string, string | undefined> {
  return {
    SCHRE_PUBLIC_ORIGIN: env.SCHRE_PUBLIC_ORIGIN,
    SCHRE_MAIL_FROM: env.SCHRE_MAIL_FROM,
    SCHRE_SIGNUP: env.SCHRE_SIGNUP,
    SCHRE_SPAM_THRESHOLD: env.SCHRE_SPAM_THRESHOLD,
    SCHRE_SPAM_PHRASES: env.SCHRE_SPAM_PHRASES,
    SCHRE_FILE_LINK_MAX_TTL: env.SCHRE_FILE_LINK_MAX_TTL,
    SCHRE_BLOB_BACKEND: env.SCHRE_BLOB_BACKEND,
    SCHRE_S3_ENDPOINT: env.SCHRE_S3_ENDPOINT,
    SCHRE_S3_BUCKET: env.SCHRE_S3_BUCKET,
    SCHRE_S3_ACCESS_KEY_ID: env.SCHRE_S3_ACCESS_KEY_ID,
    SCHRE_S3_SECRET_ACCESS_KEY: env.SCHRE_S3_SECRET_ACCESS_KEY,
    SCHRE_S3_REGION: env.SCHRE_S3_REGION,
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
