import type { Result } from '../../../base/core/result/result';
import type { TransactionContext } from '../../../../shared/persistence/unit-of-work';
import type { Content } from '../entities/content.entity';
import type {
  ContentNotEditableError,
  ContentNotFoundError,
  VersionConflictError,
} from '../errors/content.errors';
import type { ContentStatus } from '../value-objects/content-status';
import type { ContentType } from '../value-objects/content-type';
import type { EmotionCategory } from '../value-objects/emotion-category';

export type ContentListFilters = {
  q?: string;
  status?: ContentStatus;
  type?: ContentType;
  /** `null` means category IS NULL (query `none`) */
  category?: EmotionCategory | null;
  page: number;
  pageSize: number;
};

export type ContentListResult = {
  items: Content[];
  total: number;
  page: number;
  pageSize: number;
};

export type AtomicDraftUpdateError =
  | ContentNotFoundError
  | ContentNotEditableError
  | VersionConflictError;

export interface ContentRepository {
  create(content: Content, tx?: TransactionContext): Promise<Content>;
  findById(id: string, tx?: TransactionContext): Promise<Content | null>;
  list(filters: ContentListFilters): Promise<ContentListResult>;
  /**
   * Draft update with an atomic mutation predicate:
   * `WHERE id AND version = expected AND status = 'draft'`.
   * The UPDATE itself is race-safe. If zero rows match, a follow-up read
   * classifies `not_found` / `not_editable` / `version_conflict` from the
   * then-current row — that classification may observe a newer state and
   * does not claim TOCTOU-free error selection.
   */
  updateDraftAtomic(
    next: Content,
    expectedVersion: number,
    tx?: TransactionContext,
  ): Promise<Result<Content, AtomicDraftUpdateError>>;
}
