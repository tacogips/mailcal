/**
 * Every GraphQL document the client sends, in one place, so the set of
 * fields the UI depends on is auditable against the SDL without grepping
 * through components.
 */

const MESSAGE_SUMMARY_FIELDS = `
  id
  threadId
  direction
  subject
  snippet
  from { address name kind }
  recipients { address name kind }
  tags { id name color kind systemSlug messageCount }
  attachments { id fileName contentType size inline kind url }
  isSpam
  spam { score markedBy markedAt }
  spamScore
  status
  listId
  isMailingList
  deliveryStatus
  deliveryError
  readAt
  fetchStatus
  occurredAt
  domain { id name }
`;

const MESSAGE_DETAIL_FIELDS = `
  ${MESSAGE_SUMMARY_FIELDS}
  events { id messageId kind dueAt title note completedAt }
  textBody
  htmlBody
  bodyTruncated
  rfcMessageId
  rawSize
`;

export const VIEWER_QUERY = `
  query Viewer {
    viewer {
      user { id email name role }
      apiKey { id keyPrefix }
      capabilities
      sendableAddresses
    }
  }
`;

export const MESSAGES_QUERY = `
  query Messages($filter: MessageFilter, $first: Int, $after: String) {
    messages(filter: $filter, first: $first, after: $after) {
      nodes { ${MESSAGE_SUMMARY_FIELDS} }
      nextCursor
      totalCount
    }
  }
`;

export const MESSAGE_QUERY = `
  query Message($id: ID!) {
    message(id: $id) { ${MESSAGE_DETAIL_FIELDS} }
  }
`;

export const THREAD_QUERY = `
  query Thread($id: ID!) {
    thread(id: $id) {
      id
      subject
      messageCount
      lastMessageAt
      participants { address name kind }
      messages { ${MESSAGE_DETAIL_FIELDS} }
    }
  }
`;

export const TAGS_QUERY = `
  query Tags {
    tags { id name color kind systemSlug messageCount }
  }
`;

export const DOMAINS_QUERY = `
  query Domains {
    domains {
      id
      name
      status
      catchAll
      verificationToken
      verifiedAt
      messageCount
      dnsRecords { type name value priority purpose }
    }
  }
`;

export const API_KEYS_QUERY = `
  query ApiKeys {
    apiKeys {
      id
      name
      keyPrefix
      createdAt
      lastUsedAt
      expiresAt
      revokedAt
      scopes { id capability addressPattern domain { id name } }
    }
  }
`;

export const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) { ${MESSAGE_SUMMARY_FIELDS} }
  }
`;

export const TAG_MESSAGES_MUTATION = `
  mutation TagMessages($messageIds: [ID!]!, $tagIds: [ID!]!) {
    tagMessages(messageIds: $messageIds, tagIds: $tagIds) {
      id
      tags { id name color kind systemSlug messageCount }
    }
  }
`;

export const UNTAG_MESSAGES_MUTATION = `
  mutation UntagMessages($messageIds: [ID!]!, $tagIds: [ID!]!) {
    untagMessages(messageIds: $messageIds, tagIds: $tagIds) {
      id
      tags { id name color kind systemSlug messageCount }
    }
  }
`;

export const MARK_SPAM_MUTATION = `
  mutation MarkSpam($messageIds: [ID!]!) {
    markSpam(messageIds: $messageIds) { id isSpam }
  }
`;

export const MARK_NOT_SPAM_MUTATION = `
  mutation MarkNotSpam($messageIds: [ID!]!) {
    markNotSpam(messageIds: $messageIds) { id isSpam }
  }
`;

export const MARK_READ_MUTATION = `
  mutation MarkRead($messageIds: [ID!]!, $read: Boolean!) {
    markRead(messageIds: $messageIds, read: $read) { id readAt }
  }
`;

export const DELETE_MESSAGES_MUTATION = `
  mutation DeleteMessages($messageIds: [ID!]!) {
    deleteMessages(messageIds: $messageIds)
  }
`;

export const CREATE_TAG_MUTATION = `
  mutation CreateTag($name: String!, $color: String) {
    createTag(name: $name, color: $color) {
      id name color kind systemSlug messageCount
    }
  }
`;

export const RENAME_TAG_MUTATION = `
  mutation RenameTag($id: ID!, $name: String!, $color: String) {
    renameTag(id: $id, name: $name, color: $color) {
      id name color kind systemSlug messageCount
    }
  }
`;

export const DELETE_TAG_MUTATION = `
  mutation DeleteTag($id: ID!) {
    deleteTag(id: $id)
  }
`;

export const CREATE_ATTACHMENT_LINK_MUTATION = `
  mutation CreateAttachmentLink(
    $attachmentId: ID!
    $ttlSeconds: Int
    $maxDownloads: Int
  ) {
    createAttachmentLink(
      attachmentId: $attachmentId
      ttlSeconds: $ttlSeconds
      maxDownloads: $maxDownloads
    ) {
      token
      url
      link { id expiresAt maxDownloads downloadCount }
    }
  }
`;

export const CREATE_RAW_MESSAGE_LINK_MUTATION = `
  mutation CreateRawMessageLink($messageId: ID!, $ttlSeconds: Int) {
    createRawMessageLink(messageId: $messageId, ttlSeconds: $ttlSeconds) {
      token
      url
      link { id expiresAt maxDownloads downloadCount }
    }
  }
`;

export const CREATE_DOMAIN_MUTATION = `
  mutation CreateDomain($name: String!, $catchAll: Boolean) {
    createDomain(name: $name, catchAll: $catchAll) {
      id
      name
      status
      catchAll
      verificationToken
      verifiedAt
      messageCount
      dnsRecords { type name value priority purpose }
    }
  }
`;

export const VERIFY_DOMAIN_MUTATION = `
  mutation VerifyDomain($id: ID!) {
    verifyDomain(id: $id) { id status verifiedAt }
  }
`;

export const SET_DOMAIN_STATUS_MUTATION = `
  mutation SetDomainStatus($id: ID!, $status: DomainStatus!) {
    setDomainStatus(id: $id, status: $status) { id status }
  }
`;

export const CREATE_API_KEY_MUTATION = `
  mutation CreateApiKey($input: CreateApiKeyInput!) {
    createApiKey(input: $input) {
      secret
      apiKey {
        id
        name
        keyPrefix
        createdAt
        lastUsedAt
        expiresAt
        revokedAt
        scopes { id capability addressPattern domain { id name } }
      }
    }
  }
`;

export const REVOKE_API_KEY_MUTATION = `
  mutation RevokeApiKey($id: ID!) {
    revokeApiKey(id: $id) { id revokedAt }
  }
`;

export const REQUEST_EMAIL_AUTH_MUTATION = `
  mutation RequestEmailAuth($email: String!) {
    requestEmailAuth(email: $email)
  }
`;

export const VERIFY_EMAIL_AUTH_MUTATION = `
  mutation VerifyEmailAuthToken($token: String!) {
    verifyEmailAuthToken(token: $token) {
      expiresAt
      viewer {
        user { id email name role }
        apiKey { id keyPrefix }
        capabilities
        sendableAddresses
      }
    }
  }
`;

export const LOGOUT_MUTATION = `
  mutation Logout {
    logout
  }
`;

export const SAVE_DRAFT_MUTATION = `
  mutation SaveDraft($input: SaveDraftInput!) {
    saveDraft(input: $input) { ${MESSAGE_SUMMARY_FIELDS} }
  }
`;

export const SEND_DRAFT_MUTATION = `
  mutation SendDraft($id: ID!) {
    sendDraft(id: $id) { ${MESSAGE_SUMMARY_FIELDS} }
  }
`;

export const CREATE_MESSAGE_EVENT_MUTATION = `
  mutation CreateMessageEvent($input: CreateMessageEventInput!) {
    createMessageEvent(input: $input) {
      id messageId kind dueAt title note completedAt
    }
  }
`;

export const UPDATE_MESSAGE_EVENT_MUTATION = `
  mutation UpdateMessageEvent($id: ID!, $input: UpdateMessageEventInput!) {
    updateMessageEvent(id: $id, input: $input) {
      id messageId kind dueAt title note completedAt
    }
  }
`;

export const DELETE_MESSAGE_EVENT_MUTATION = `
  mutation DeleteMessageEvent($id: ID!) {
    deleteMessageEvent(id: $id)
  }
`;

const RULE_FIELDS = `
  id
  domain { id name }
  field
  matcher
  pattern
  action
  tag { id name color kind systemSlug messageCount }
  enabled
  description
  createdAt
`;

export const CLASSIFICATION_RULES_QUERY = `
  query ClassificationRules {
    classificationRules { ${RULE_FIELDS} }
  }
`;

export const CREATE_CLASSIFICATION_RULE_MUTATION = `
  mutation CreateClassificationRule($input: CreateClassificationRuleInput!) {
    createClassificationRule(input: $input) { ${RULE_FIELDS} }
  }
`;

export const SET_CLASSIFICATION_RULE_ENABLED_MUTATION = `
  mutation SetClassificationRuleEnabled($id: ID!, $enabled: Boolean!) {
    setClassificationRuleEnabled(id: $id, enabled: $enabled) { id enabled }
  }
`;

export const DELETE_CLASSIFICATION_RULE_MUTATION = `
  mutation DeleteClassificationRule($id: ID!) {
    deleteClassificationRule(id: $id)
  }
`;
