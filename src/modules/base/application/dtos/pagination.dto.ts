export type PaginatedResponseDTO<T> = {
  items: T[];
  page: number;
  limit: number;
  totalItems: number;
  hasNextPage: boolean;
};
