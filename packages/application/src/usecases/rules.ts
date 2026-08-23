import { Capability } from "@yabumi/domain/entities/api-key";
import {
  type ClassificationRule,
  createClassificationRule,
  type RuleAction,
  RuleAction as RuleActionEnum,
  type RuleField,
  type RuleMatcher,
  setRuleEnabled,
} from "@yabumi/domain/entities/classification-rule";
import {
  type ClassificationRuleId,
  createClassificationRuleId,
  type DomainId,
  type TagId,
} from "@yabumi/domain/value-objects/ids";
import type { AppDependencies } from "../dependencies";
import { NotFoundError } from "../errors";
import { requireGlobalCapability } from "../policies/authorization";
import type { Viewer } from "../policies/viewer";
import { withAsyncDomainErrorTranslation } from "./translate-domain-error";

export interface CreateRuleInput {
  readonly domainId?: DomainId | null;
  readonly field: RuleField;
  readonly matcher: RuleMatcher;
  readonly pattern: string;
  readonly action: RuleAction;
  readonly tagId?: TagId | null;
  readonly description?: string | null;
}

/** Rules rewrite how every inbound message on a domain is classified, so
 * they sit behind DOMAIN_ADMIN -- the capability that already governs
 * domain-wide ingest behaviour -- rather than MAIL_MANAGE. */
function requireRuleAdmin(viewer: Viewer): void {
  requireGlobalCapability(viewer, Capability.DomainAdmin);
}

async function requireTagExists(
  deps: AppDependencies,
  tagId: TagId | null,
): Promise<void> {
  if (tagId === null) {
    return;
  }
  const tags = await deps.tagRepository.findByIds([tagId]);
  if (tags.length === 0) {
    throw new NotFoundError("Tag", tagId);
  }
}

async function requireDomainExists(
  deps: AppDependencies,
  domainId: DomainId | null,
): Promise<void> {
  if (domainId === null) {
    return;
  }
  const domain = await deps.mailDomainRepository.findById(domainId);
  if (domain === null) {
    throw new NotFoundError("Domain", domainId);
  }
}

export function createCreateClassificationRuleUseCase(
  deps: AppDependencies,
): (viewer: Viewer, input: CreateRuleInput) => Promise<ClassificationRule> {
  return async (viewer, input) =>
    withAsyncDomainErrorTranslation(async () => {
      const domainId = input.domainId ?? null;
      requireRuleAdmin(viewer);
      await requireDomainExists(deps, domainId);
      const tagId =
        input.action === RuleActionEnum.Tag ? (input.tagId ?? null) : null;
      await requireTagExists(deps, tagId);
      const rule = createClassificationRule({
        id: createClassificationRuleId(deps.random.uuid()),
        domainId,
        field: input.field,
        matcher: input.matcher,
        pattern: input.pattern,
        action: input.action,
        tagId,
        description: input.description ?? null,
        createdAt: deps.clock.now().toISOString(),
      });
      await deps.classificationRuleRepository.save(rule);
      return rule;
    });
}

export function createSetClassificationRuleEnabledUseCase(
  deps: AppDependencies,
): (
  viewer: Viewer,
  id: ClassificationRuleId,
  enabled: boolean,
) => Promise<ClassificationRule> {
  return async (viewer, id, enabled) => {
    const rule = await deps.classificationRuleRepository.findById(id);
    if (rule === null) {
      throw new NotFoundError("ClassificationRule", id);
    }
    requireRuleAdmin(viewer);
    const updated = setRuleEnabled(
      rule,
      enabled,
      deps.clock.now().toISOString(),
    );
    await deps.classificationRuleRepository.save(updated);
    return updated;
  };
}

export function createDeleteClassificationRuleUseCase(
  deps: AppDependencies,
): (viewer: Viewer, id: ClassificationRuleId) => Promise<boolean> {
  return async (viewer, id) => {
    const rule = await deps.classificationRuleRepository.findById(id);
    if (rule === null) {
      throw new NotFoundError("ClassificationRule", id);
    }
    requireRuleAdmin(viewer);
    await deps.classificationRuleRepository.delete(id);
    return true;
  };
}

export function createListClassificationRulesUseCase(
  deps: AppDependencies,
): (viewer: Viewer) => Promise<readonly ClassificationRule[]> {
  return async (viewer) => {
    requireRuleAdmin(viewer);
    return deps.classificationRuleRepository.list();
  };
}
