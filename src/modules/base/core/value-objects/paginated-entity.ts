export type PaginatedEntity<T> = {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  hasNextPage: boolean;
};

export function paginate<T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number,
): PaginatedEntity<T> {
  return {
    items,
    page,
    limit,
    totalItems,
    hasNextPage: page * limit < totalItems,
  };
}
