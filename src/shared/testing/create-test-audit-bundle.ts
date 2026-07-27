import { composeAuditService } from '../../modules/audit/application/compose-audit';
import type { AuditService } from '../../modules/audit/application/services/audit.service';
import { InMemoryAuditEventRepository } from '../../modules/audit/tests/fakes/in-memory-audit-event.repository';
import { InMemoryUnitOfWork } from '../testing/fakes/in-memory-unit-of-work';
import type { UnitOfWork } from '../persistence/unit-of-work';

export type TestAuditBundle = {
  events: InMemoryAuditEventRepository;
  audit: AuditService;
  unitOfWork: UnitOfWork;
};

export function createTestAuditBundle(options?: {
  now?: () => Date;
  newId?: () => string;
}): TestAuditBundle {
  const events = new InMemoryAuditEventRepository();
  return {
    events,
    audit: composeAuditService({
      events,
      now: options?.now,
      newId: options?.newId,
    }),
    unitOfWork: new InMemoryUnitOfWork(),
  };
}
