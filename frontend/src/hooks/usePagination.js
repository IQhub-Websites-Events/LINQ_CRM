/**
 * usePagination — manages page state and derives slice info.
 */
import { useState } from "react";

export function usePagination(pageSize = 50) {
  const [page, setPage] = useState(1);

  const reset = () => setPage(1);
  const next  = (totalPages) => setPage((p) => Math.min(p + 1, totalPages));
  const prev  = () => setPage((p) => Math.max(p - 1, 1));

  return { page, setPage, reset, next, prev };
}
