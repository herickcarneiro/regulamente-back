type ValidationIssue = {
  path?: string;
  message?: string;
  summary?: string;
};

/**
 * Builds a transport-safe validation payload.
 * Never echoes request body values (passwords, tokens, etc.).
 */
export function sanitizeValidationError(error: {
  message?: string;
  all?: unknown;
}): {
  error: 'validation';
  message: string;
  details?: ValidationIssue[];
} {
  const details = Array.isArray(error.all)
    ? error.all.map((issue) => {
        const item = issue as ValidationIssue;
        return {
          path: typeof item.path === 'string' ? item.path : undefined,
          message:
            typeof item.message === 'string'
              ? item.message
              : typeof item.summary === 'string'
                ? item.summary
                : 'Invalid field',
        };
      })
    : undefined;

  return {
    error: 'validation',
    message: 'Invalid request',
    ...(details && details.length > 0 ? { details } : {}),
  };
}
