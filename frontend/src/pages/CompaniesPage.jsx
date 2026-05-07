import { useState } from "react";
import { companiesApi } from "../api";
import { SortableTh, Pager, EmptyState, Td } from "../components/ui/Table";
import { useFetch } from "../hooks/useFetch";
import { useSort } from "../hooks/useSort";
import { usePagination } from "../hooks/usePagination";
import { fmt } from "../utils/helpers";

const PAGE_SIZE = 50;

export function CompaniesPage() {
  const [search, setSearch] = useState("");
  const { sort, toggle }    = useSort("name", "asc");
  const { page, setPage }   = usePagination();

  const { data, loading } = useFetch(
    () => companiesApi.list({ page, page_size: PAGE_SIZE, ...(search ? { search } : {}),
      ordering: sort.dir === "asc" ? sort.key : `-${sort.key}` }),
    [page, search, sort.key, sort.dir]
  );

  const items = data?.results || [];
  const total = data?.count || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ margin: 0, fontSize: 18, color: "#495057", textTransform: "uppercase", fontWeight: 700 }}>Companies</h4>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#878a99" }}>Directory of all registered companies and their details.</p>
      </div>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px", background: "#fff", borderBottom: "1px solid var(--vz-card-border-color)",
          display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f3f3f9",
            border: "1px solid #e9ebec", borderRadius: 4, padding: "8px 12px", flex: 1, maxWidth: 300 }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <circle cx="5" cy="5" r="4"/><path d="M9 9l2.5 2.5"/>
            </svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search companies..." style={{ background: "none", border: "none", outline: "none",
                fontSize: 13, color: "#495057", width: "100%", fontFamily: "inherit" }} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f3f6f9" }}>
                <SortableTh sortKey="name"         sort={sort} onSort={toggle}>Company</SortableTh>
                <SortableTh sortKey="city"         sort={sort} onSort={toggle}>City</SortableTh>
                <SortableTh sortKey="country"      sort={sort} onSort={toggle}>Country</SortableTh>
                <SortableTh sortKey="website"      sort={sort} onSort={toggle}>Website</SortableTh>
                <SortableTh sortKey="created_at"   sort={sort} onSort={toggle}>Added</SortableTh>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
              : items.length === 0 ? <EmptyState title="No companies yet" subtitle="Companies are added automatically when bookings arrive" />
              : items.map((co) => (
                <tr key={co.id} style={{ borderBottom: "1px solid var(--vz-card-border-color)", transition: "background .2s ease" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f3f3f9"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}>
                  <Td><span style={{ fontWeight: 600, color: "var(--vz-primary)" }}>{co.name}</span></Td>
                  <Td muted>{co.city}</Td>
                  <Td muted>{co.country}</Td>
                  <Td>{co.website ? <a href={co.website} target="_blank" rel="noreferrer"
                    style={{ color: "var(--vz-primary)", fontSize: 13, fontWeight: 500 }}>{co.website.replace(/^https?:\/\//, "")}</a> : "—"}</Td>
                  <Td muted>{fmt.dateShort(co.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pager page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        total={total} pageSize={PAGE_SIZE} onPage={setPage} />
    </div>
  );
}


