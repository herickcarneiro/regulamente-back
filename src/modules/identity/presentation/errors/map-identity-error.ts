import type { DomainError } from '../../../base/core/errors/domain.error';
import {
  domainErrorBody,
  mapDomainErrorToStatus,
} from '../../../base/presentation/errors/map-domain-error';

export function respondDomainError(
  set: { status?: number | string },
  error: DomainError,
) {
  set.status = mapDomainErrorToStatus(error);
  return domainErrorBody(error);
}
