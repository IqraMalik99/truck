"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TruckIcon } from "../../components/admin/icons";

const cardShadow = "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)";

function StatusBadge({ status }) {
  const isAvailable = status === "available";
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 999,
        background: isAvailable ? "#dcfce7" : "#fef3c7",
        color: isAvailable ? "#16a34a" : "#b45309",
      }}
    >
      {isAvailable ? "Available" : "In use"}
    </span>
  );
}

export default function TrucksPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (p) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/trucks?page=${p}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message || "Couldn't load trucks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  return (
    <div>
      <div style={{ marginBottom: 20, paddingBottom: 18, borderBottom: "1px solid #e9ecf0" }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, color: "#111827", margin: 0 }}>Trucks</h1>
        <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>Real-time  status and per-truck monthly reports.</p>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading || !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: 62, borderRadius: 10, background: "#f3f4f6" }} />
            ))
          : data.trucks.map((t) => (
              <Link
                key={t._id}
                href={`/admin/trucks/${t._id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "white",
                  border: "1px solid #edf0f3",
                  borderRadius: 10,
                  padding: "14px 16px",
                  boxShadow: cardShadow,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eef2f7", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
                    <TruckIcon />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Unit {t.unitNumber}</p>
                    <p style={{ fontSize: 11.5, color: "#6b7280", margin: "2px 0 0" }}>
                      {t.currentOdometer != null ? `${t.currentOdometer.toLocaleString()} mi` : "No odometer on file"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </Link>
            ))}
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 20 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", background: "white", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.5 : 1 }}
          >
            Previous
          </button>
          <span style={{ fontSize: 12.5, color: "#6b7280" }}>Page {data.page} of {data.totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", background: "white", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", cursor: page === data.totalPages ? "default" : "pointer", opacity: page === data.totalPages ? 0.5 : 1 }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}