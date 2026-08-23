import type { GraphQLSchema } from "graphql";
import { createSchema, createYoga } from "graphql-yoga";
import type { GraphQLContext } from "./context";
import { useDepthLimit } from "./depth-limit";
import { typeDefs } from "./schema.graphql";
import { toGraphQLError } from "./errors";
import { mutationResolvers } from "./resolvers/mutation";
import { queryResolvers } from "./resolvers/query";
import {
  apiKeyResolvers,
  apiKeyScopeResolvers,
  apiKeyWithSecretResolvers,
  attachmentResolvers,
  fileLinkResolvers,
  mailDomainResolvers,
  messageResolvers,
  tagResolvers,
  classificationRuleResolvers,
  threadResolvers,
  viewerResolvers,
} from "./resolvers/types";
import { useSelectionLimit } from "./selection-limit";

/** Merges the SDL with every resolver module into an executable schema.
 *
 * `MailboxAddress`, `DnsRecord`, `User`, `MessagePage`, `AuthPayload` and
 * `CreatedFileLink` need no dedicated resolvers: their fields are plain
 * property access on the objects the use cases already return.
 * `BootstrapPayload` reuses `ApiKeyWithSecret`'s resolvers -- both carry an
 * `apiKey` plus a one-time `secret`, and `user` is plain property access. */
export function buildGraphQLSchema(): GraphQLSchema {
  return createSchema<GraphQLContext>({
    typeDefs,
    resolvers: {
      Query: queryResolvers,
      Mutation: mutationResolvers,
      Message: messageResolvers,
      MailDomain: mailDomainResolvers,
      Tag: tagResolvers,
      Attachment: attachmentResolvers,
      ApiKey: apiKeyResolvers,
      ApiKeyScope: apiKeyScopeResolvers,
      ApiKeyWithSecret: apiKeyWithSecretResolvers,
      BootstrapPayload: apiKeyWithSecretResolvers,
      FileLink: fileLinkResolvers,
      Thread: threadResolvers,
      ClassificationRule: classificationRuleResolvers,
      Viewer: viewerResolvers,
    },
  });
}

/** Wraps the schema in a fetch-native graphql-yoga server.
 *
 * Every thrown value goes through `toGraphQLError` via yoga's
 * `maskedErrors.maskError` hook, so `extensions.code` is always present and
 * an unrecognized error is always masked. The two limit plugins reject
 * pathological documents before execution -- this endpoint is exposed to
 * untrusted agents. */
export function createGraphQLYoga(
  schema: GraphQLSchema,
  options: { graphiql: boolean },
): ReturnType<typeof createYoga<Record<string, unknown>, GraphQLContext>> {
  return createYoga<Record<string, unknown>, GraphQLContext>({
    schema,
    graphiql: options.graphiql,
    // The caller resolves the viewer, builds a full `GraphQLContext`, and
    // passes it as the extra server-context argument to
    // `yoga.fetch(request, context)`; it flows through unchanged here.
    context: (initialContext) => initialContext as unknown as GraphQLContext,
    plugins: [useDepthLimit(), useSelectionLimit()],
    maskedErrors: {
      maskError: (error) => toGraphQLError(error),
    },
  });
}
