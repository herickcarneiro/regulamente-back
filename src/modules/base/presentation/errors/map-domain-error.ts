import type { DomainError } from '../../core/errors/domain.error';

export function mapDomainErrorToStatus(error: DomainError): number {
  switch (error.code) {
    case 'NOT_FOUND':
      return 404;
    case 'INVALID_INPUT':
      return 400;
    case 'INVALID_CREDENTIALS':
    case 'INACTIVE_USER':
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'CONTENT_NOT_EDITABLE':
    case 'VERSION_CONFLICT':
    case 'CONFLICT':
      return 409;
    default:
      return 500;
  }
}

export function domainErrorBody(error: DomainError) {
  return {
    error: mapDomainErrorCodeToTransport(error.code),
    message: error.message,
  };
}

function mapDomainErrorCodeToTransport(code: string): string {
  switch (code) {
    case 'INVALID_INPUT':
      return 'validation';
    case 'INVALID_CREDENTIALS':
      return 'invalid_credentials';
    case 'INACTIVE_USER':
      return 'inactive_user';
    case 'UNAUTHORIZED':
      return 'unauthorized';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'NOT_FOUND':
      return 'not_found';
    case 'CONTENT_NOT_EDITABLE':
    case 'VERSION_CONFLICT':
    case 'CONFLICT':
      return 'conflict';
    default:
      return 'internal';
  }
}
