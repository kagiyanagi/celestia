export type PaginationSearchParams = {
  page?: string | string[];
};

export function parsePageParam(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const page = Number(rawValue);

  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}
