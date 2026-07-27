import type { AuditEventRepository } from '../core/repositories/audit-event.repository';
import { AppendAuditEventUseCase } from '../core/use-cases/append-audit-event.use-case';
import { ListAuditEventsUseCase } from '../core/use-cases/list-audit-events.use-case';
import { AuditService } from './services/audit.service';

export type ComposeAuditOptions = {
  events: AuditEventRepository;
  now?: () => Date;
  newId?: () => string;
};

export function composeAuditService(options: ComposeAuditOptions): AuditService {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());

  return new AuditService({
    appendAuditEvent: new AppendAuditEventUseCase({
      events: options.events,
      now,
      newId,
    }),
    listAuditEvents: new ListAuditEventsUseCase({ events: options.events }),
  });
}
