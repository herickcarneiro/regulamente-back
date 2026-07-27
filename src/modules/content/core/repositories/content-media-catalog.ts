/**
 * Narrow anti-corruption port: Content sees only opaque Media identity +
 * link eligibility fields. No Media entity / repository imports.
 *
 * Result (not null): NOT_FOUND vs other domain errors must not collapse.
 */
import type { DomainError } from '../../../base/core/errors/domain.error';
import type { Result } from '../../../base/core/result/result';

export type ContentMediaAssetView = {
  id: string;
  kind: string;
  status: string;
};

export interface ContentMediaCatalog {
  findById(id: string): Promise<Result<ContentMediaAssetView, DomainError>>;
}
