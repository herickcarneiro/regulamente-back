import type { DomainError } from '../../../base/core/errors/domain.error';
import { fail, ok, type Result } from '../../../base/core/result/result';
import type { AuditService } from '../../../audit/application/services/audit.service';
import { runAtomic } from '../../../../shared/persistence/run-atomic';
import type { UnitOfWork } from '../../../../shared/persistence/unit-of-work';
import type { Content } from '../../core/entities/content.entity';
import { ContentValidationError } from '../../core/errors/content.errors';
import type { ContentMediaCatalog } from '../../core/repositories/content-media-catalog';
import type { ContentListFilters } from '../../core/repositories/content.repository';
import { assertLinkableMediaAsset } from '../../core/use-cases/assert-linkable-media-asset';
import type { CreateContentDraftUseCase } from '../../core/use-cases/create-content-draft.use-case';
import type { GetContentByIdUseCase } from '../../core/use-cases/get-content-by-id.use-case';
import type { ListContentsUseCase } from '../../core/use-cases/list-contents.use-case';
import type { UpdateContentDraftUseCase } from '../../core/use-cases/update-content-draft.use-case';
import type { ContentType } from '../../core/value-objects/content-type';
import type {
  ContentActor,
  ContentDetailDto,
  ContentListItemDto,
  ContentListResponseDto,
  CreateContentDraftDto,
  UpdateContentDraftDto,
} from '../dtos/content.dto';

export type ContentServiceDeps = {
  createContentDraft: CreateContentDraftUseCase;
  getContentById: GetContentByIdUseCase;
  listContents: ListContentsUseCase;
  updateContentDraft: UpdateContentDraftUseCase;
  mediaCatalog: ContentMediaCatalog;
  audit: AuditService;
  unitOfWork: UnitOfWork;
};

function typeAcceptsMedia(type: ContentType): boolean {
  return type === 'video' || type === 'mixed';
}

/**
 * Local wire rule before ACL: text|audio + non-null mediaAssetId → validation.
 */
function assertLocalMediaTypeCompatibility(
  type: ContentType,
  mediaAssetId: string | null,
): Result<void, ContentValidationError> {
  if (mediaAssetId !== null && !typeAcceptsMedia(type)) {
    return fail(
      new ContentValidationError(
        'mediaAssetId requires content type video or mixed',
      ),
    );
  }
  return ok(undefined);
}

/**
 * Application service: orquestra use-cases, auditoria atômica e mapeia Entity → DTO.
 * Não acessa ContentRepository. Vínculo Media: type local → ACL → TX Content+Audit.
 */
export class ContentService {
  constructor(private readonly deps: ContentServiceDeps) {}

  async createDraft(
    actor: ContentActor,
    input: CreateContentDraftDto,
  ): Promise<Result<ContentDetailDto, DomainError>> {
    const mediaAssetId =
      input.mediaAssetId === undefined ? null : input.mediaAssetId;

    const local = assertLocalMediaTypeCompatibility(input.type, mediaAssetId);
    if (!local.ok) {
      return local;
    }

    if (mediaAssetId !== null) {
      const link = await assertLinkableMediaAsset(
        this.deps.mediaCatalog,
        mediaAssetId,
      );
      if (!link.ok) {
        return link;
      }
    }

    return runAtomic(this.deps.unitOfWork, async (tx) => {
      const result = await this.deps.createContentDraft.execute({
        actor,
        title: input.title,
        type: input.type,
        category: input.category ?? null,
        description: input.description ?? '',
        body: input.body ?? '',
        mediaAssetId,
        tx,
      });
      if (!result.ok) {
        return result;
      }

      const audit = await this.deps.audit.append(
        {
          actorUserId: actor.userId,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'content.draft_created',
          targetType: 'content',
          targetId: result.value.id,
          targetLabel: result.value.title,
        },
        tx,
      );
      if (!audit.ok) {
        return audit;
      }

      return ok(this.toDetailDto(result.value));
    });
  }

  async getById(id: string): Promise<Result<ContentDetailDto, DomainError>> {
    const result = await this.deps.getContentById.execute({ id });
    if (!result.ok) {
      return result;
    }
    return ok(this.toDetailDto(result.value));
  }

  async list(
    filters: ContentListFilters,
  ): Promise<Result<ContentListResponseDto, DomainError>> {
    const result = await this.deps.listContents.execute(filters);
    if (!result.ok) {
      return result;
    }
    return ok({
      items: result.value.items.map((item) => this.toListItemDto(item)),
      total: result.value.total,
      page: result.value.page,
      pageSize: result.value.pageSize,
    });
  }

  async updateDraft(
    actor: ContentActor,
    id: string,
    input: UpdateContentDraftDto,
  ): Promise<Result<ContentDetailDto, DomainError>> {
    if (input.mediaAssetId !== undefined && input.mediaAssetId !== null) {
      let effectiveType = input.type;
      if (effectiveType === undefined) {
        const current = await this.deps.getContentById.execute({ id });
        if (!current.ok) {
          return current;
        }
        effectiveType = current.value.type;
      }

      const local = assertLocalMediaTypeCompatibility(
        effectiveType,
        input.mediaAssetId,
      );
      if (!local.ok) {
        return local;
      }

      const link = await assertLinkableMediaAsset(
        this.deps.mediaCatalog,
        input.mediaAssetId,
      );
      if (!link.ok) {
        return link;
      }
    }

    return runAtomic(this.deps.unitOfWork, async (tx) => {
      const result = await this.deps.updateContentDraft.execute({
        id,
        expectedVersion: input.expectedVersion,
        title: input.title,
        description: input.description,
        body: input.body,
        type: input.type,
        category: input.category,
        mediaAssetId: input.mediaAssetId,
        tx,
      });
      if (!result.ok) {
        return result;
      }

      const audit = await this.deps.audit.append(
        {
          actorUserId: actor.userId,
          actorName: actor.name,
          actorRole: actor.role,
          action: 'content.draft_updated',
          targetType: 'content',
          targetId: result.value.id,
          targetLabel: result.value.title,
        },
        tx,
      );
      if (!audit.ok) {
        return audit;
      }

      return ok(this.toDetailDto(result.value));
    });
  }

  private toListItemDto(content: Content): ContentListItemDto {
    return {
      id: content.id,
      title: content.title,
      type: content.type,
      category: content.category,
      status: content.status,
      authorName: content.authorName,
      updatedAt: content.updatedAt.toISOString(),
      version: content.version,
    };
  }

  private toDetailDto(content: Content): ContentDetailDto {
    return {
      ...this.toListItemDto(content),
      description: content.description,
      body: content.body,
      createdAt: content.createdAt.toISOString(),
      authorUserId: content.authorUserId,
      mediaAssetId: content.mediaAssetId,
    };
  }
}
