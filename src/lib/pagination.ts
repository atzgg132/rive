export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type PaginationRequest = {
  page: number;
  pageSize: number;
};

export type PaginationMeta = PaginationRequest & {
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaults: { pageSize?: number; maxPageSize?: number } = {},
): PaginationRequest {
  const maxPageSize = defaults.maxPageSize || MAX_PAGE_SIZE;
  const defaultPageSize = Math.min(defaults.pageSize || DEFAULT_PAGE_SIZE, maxPageSize);
  const page = positiveInteger(searchParams.get("page"), 1);
  const requestedPageSize = positiveInteger(searchParams.get("pageSize"), defaultPageSize);

  return {
    page,
    pageSize: Math.min(requestedPageSize, maxPageSize),
  };
}

export function buildPagination(total: number, requested: PaginationRequest): PaginationMeta {
  const totalPages = total > 0 ? Math.ceil(total / requested.pageSize) : 0;
  const page = totalPages > 0 ? Math.min(requested.page, totalPages) : 1;

  return {
    page,
    pageSize: requested.pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

export function paginationOffset(meta: PaginationMeta): number {
  return (meta.page - 1) * meta.pageSize;
}
