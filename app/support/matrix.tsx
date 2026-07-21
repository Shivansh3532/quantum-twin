"use client";
import { useState } from "react";
import { supportMatrix, type SupportLevel } from "../../src/support.ts";

const COLS = [
  { key: "detector", label: "Detector", help: "Finds this cryptography in your code." },
  { key: "adapter", label: "Adapter", help: "Can automatically rewrite it to the post-quantum target." },
  { key: "verifier", label: "Verifier", help: "Has repeatable checks that prove the result works." },
  { key: "systemFixture", label: "Test environment", help: "A committed sample system exercises this end to end." },
  { key: "windows", label: "Windows", help: "Proven on Windows CI." },
  { key: "ubuntu", label: "Ubuntu", help: "Proven on Ubuntu CI." },
] as const;

const FILTERS: Array<{ id: "ALL" | SupportLevel; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "FULLY_SUPPORTED", label: "Fully supported" },
  { id: "EXPERIMENTAL", label: "Experimental" },
  { id: "DISCOVERY_ONLY", label: "Discovery only" },
];

function Cell({ on }: { on: boolean }) {
  return <td className={on ? "pass" : "fail"}><span aria-hidden="true">{on ? "✓" : "–"}</span><span className="sr-only">{on ? "Yes" : "No"}</span></td>;
}

export default function SupportMatrix() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("ALL");
  const rows = supportMatrix.rows.filter(row => filter === "ALL" || row.level === filter);
  return <>
    <div className="matrix-filters" role="group" aria-label="Filter support level">
      {FILTERS.map(item => <button key={item.id} type="button" className={`chip${filter === item.id ? " on" : ""}`} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}
    </div>
    <div className="table-wrap matrix-wrap" tabIndex={0}>
      <table className="matrix">
        <thead><tr><th scope="col">Supported migration</th><th scope="col">Level</th>{COLS.map(col => <th key={col.key} scope="col"><span>{col.label}</span><small>{col.help}</small></th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.boundary}>
          <th scope="row">{row.boundary}</th>
          <td><span className={`badge lvl-${row.level}`}>{row.level.replaceAll("_", " ")}</span></td>
          {COLS.map(col => <Cell key={col.key} on={Boolean(row[col.key])}/>)}
        </tr>)}</tbody>
      </table>
    </div>
    {rows.length === 0 && <p className="empty">No boundaries match this filter.</p>}
  </>;
}
