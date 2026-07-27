import type { AuditService } from '../../audit/application/services/audit.service';
import type { UnitOfWork } from '../../../shared/persistence/unit-of-work';
import type { ContentMediaCatalog } from '../core/repositories/content-media-catalog';
import type { ContentRepository } from '../core/repositories/content.repository';
import { CreateContentDraftUseCase } from '../core/use-cases/create-content-draft.use-case';
import { GetContentByIdUseCase } from '../core/use-cases/get-content-by-id.use-case';
import { ListContentsUseCase } from '../core/use-cases/list-contents.use-case';
import { UpdateContentDraftUseCase } from '../core/use-cases/update-content-draft.use-case';
import { ContentService } from './services/content.service';

export type ComposeContentOptions = {
  contents: ContentRepository;
  mediaCatalog: ContentMediaCatalog;
  audit: AuditService;
  unitOfWork: UnitOfWork;
  now?: () => Date;
  newId?: () => string;
};

/** Wired graph for Content: repository → use-cases → service (no repo on service). */
export function composeContentService(
  options: ComposeContentOptions,
): ContentService {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());

  return new ContentService({
    createContentDraft: new CreateContentDraftUseCase({
      contents: options.contents,
      now,
      newId,
    }),
    getContentById: new GetContentByIdUseCase({ contents: options.contents }),
    listContents: new ListContentsUseCase({ contents: options.contents }),
    updateContentDraft: new UpdateContentDraftUseCase({
      contents: options.contents,
      now,
    }),
    mediaCatalog: options.mediaCatalog,
    audit: options.audit,
    unitOfWork: options.unitOfWork,
  });
}
