import type { ClassificationRule } from "@yabumi/domain/entities/classification-rule";
import type {
  ClassificationRuleId,
  DomainId,
} from "@yabumi/domain/value-objects/ids";

export interface ClassificationRuleRepository {
  findById(id: ClassificationRuleId): Promise<ClassificationRule | null>;
  save(rule: ClassificationRule): Promise<void>;
  delete(id: ClassificationRuleId): Promise<void>;
  list(): Promise<readonly ClassificationRule[]>;
  /** Enabled rules applicable to a receiving domain: its own plus the
   * global (`domainId` null) ones. This is the ingest hot path. */
  listEnabledForDomain(
    domainId: DomainId,
  ): Promise<readonly ClassificationRule[]>;
}
