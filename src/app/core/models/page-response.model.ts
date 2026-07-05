/** Mirrors library-service's generic Pageable response wrapper (e.g. PageResponseBookDto). */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
