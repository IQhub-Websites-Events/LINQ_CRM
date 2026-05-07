/**
 * useSort — sortable column state.
 */
import { useState, useMemo } from "react";

export function useSort(defaultKey = "", defaultDir = "desc") {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });

  const toggle = (key) =>
    setSort((s) => s.key === key
      ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
      : { key, dir: "asc" }
    );

  const sortData = (arr) => {
    if (!sort.key || !arr) return arr;
    return [...arr].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  };

  return { sort, toggle, sortData };
}
