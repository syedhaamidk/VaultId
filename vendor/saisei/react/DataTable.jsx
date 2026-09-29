import { useMemo, useState } from "react";

/* DataTable — generic sortable / filterable / paged table over the kit's
   .table styles. columns: [{ key, label, numeric? }], rows: array of objects. */
export default function DataTable({
  columns,
  rows,
  pageSize = 6,
  filterPlaceholder = "Filter…",
  labelledBy,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let out = f
      ? rows.filter((r) =>
          columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(f))
        )
      : rows.slice();
    if (sortKey) {
      out = out.slice().sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
        return String(av ?? "").localeCompare(String(bv ?? "")) * sortDir;
      });
    }
    return out;
  }, [rows, columns, filter, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const sortBy = (key) => {
    if (sortKey === key) setSortDir((d) => d * -1);
    else { setSortKey(key); setSortDir(1); }
  };

  return (
    <div>
      <div className="datatable-bar">
        <div className="field">
          <label className="label" htmlFor="datatable-filter">Filter</label>
          <input
            className="input"
            id="datatable-filter"
            type="search"
            placeholder={filterPlaceholder}
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          />
        </div>
        <div className="pager">
          <button className="btn btn-secondary btn-sm" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </button>
          <span>Page {safePage} / {pages} · {filtered.length} rows</span>
          <button className="btn btn-secondary btn-sm" disabled={safePage >= pages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </button>
        </div>
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Data table, scrollable">
        <table className="table" aria-labelledby={labelledBy}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  tabIndex={0}
                  aria-sort={sortKey === c.key ? (sortDir === 1 ? "ascending" : "descending") : "none"}
                  onClick={() => sortBy(c.key)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortBy(c.key); } }}
                  style={{ cursor: "pointer" }}
                >
                  {c.label}
                  <span className="sort-arrow" aria-hidden="true">
                    {sortKey === c.key ? (sortDir === 1 ? "▲" : "▼") : "△"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length ? (
              slice.map((r, i) => (
                <tr key={r.id ?? i}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(r[c.key], r) : String(r[c.key] ?? "—")}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr><td colSpan={columns.length}>No rows match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
