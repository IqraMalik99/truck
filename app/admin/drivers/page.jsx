"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const cardShadow = "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)";

const shimmerStyle = {
  background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%)",
  backgroundSize: "400% 100%",
  animation: "drv-shimmer 1.4s ease infinite",
  borderRadius: 6,
};

function initials(name) {
  if (!name || name === "—") return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Avatar({ name }) {
  return (
    <div
      style={{
        width: 36,
        height: 36,
        minWidth: 36,
        borderRadius: "50%",
        background: "#dbeafe",
        color: "#2563eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 700,
      }}
    >
      {initials(name)}
    </div>
  );
}

function DriverRowSkeleton() {
  return (
    <div className="drv-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
      <div style={{ ...shimmerStyle, width: 36, height: 36, borderRadius: "50%" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ ...shimmerStyle, width: 120, height: 13 }} />
        <div style={{ ...shimmerStyle, width: 80, height: 10 }} />
      </div>
      <div style={{ ...shimmerStyle, width: 90, height: 13 }} className="drv-col-hide-sm" />
      <div style={{ ...shimmerStyle, width: 70, height: 13 }} className="drv-col-hide-sm" />
    </div>
  );
}

function DriverCard({ driver }) {
  return (
    <Link
      href={`/admin/drivers/query?id=${driver.id}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 18px",
        borderBottom: "1px solid #f1f3f5",
        textDecoration: "none",
        color: "inherit",
      }}
      className="drv-row"
    >
      <Avatar name={driver.name} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "#111827",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {driver.name}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "#6b7280",
            marginTop: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {driver.carrierName}
        </div>
        {/* shown only on narrow screens, in place of the hidden columns */}
        <div className="drv-inline-meta" style={{ display: "none", fontSize: 11, color: "#9ca3af", marginTop: 4, gap: 10 }}>
          <span>{driver.phone}</span>
          <span>·</span>
          <span>Lic {driver.email}</span>
        </div>
      </div>

      <div className="drv-col-hide-sm" style={{ fontSize: 12.5, color: "#374151", width: 120, flexShrink: 0 }}>
        {driver.phone}
      </div>
      <div className="drv-col-hide-sm" style={{ fontSize: 12.5, color: "#374151", width: 100, flexShrink: 0 }}>
        {driver.licenseNumber}
      </div>
    </Link>
  );
}

function PaginationBar({ page, totalPages, hasPrev, hasNext, onChange, total, limit }) {
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd = Math.min(page * limit, total);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "12px 18px",
        borderTop: "1px solid #edf0f3",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontSize: 11.5, color: "#6b7280" }}>
        {total === 0 ? "No drivers" : `${rangeStart}–${rangeEnd} of ${total}`}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          onClick={() => onChange(page - 1)}
          disabled={!hasPrev}
          style={pagerBtnStyle(!hasPrev)}
        >
          Prev
        </button>
        <span style={{ fontSize: 12, color: "#374151", padding: "6px 8px", fontWeight: 600 }}>
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={!hasNext}
          style={pagerBtnStyle(!hasNext)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function pagerBtnStyle(disabled) {
  return {
    fontSize: 12,
    fontWeight: 600,
    color: disabled ? "#c1c7d0" : "#374151",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 7,
    padding: "6px 12px",
    cursor: disabled ? "default" : "pointer",
  };
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasNext: false, hasPrev: false });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Debounce the search box so we don't fire a request on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (page, searchTerm) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (searchTerm) params.set("search", searchTerm);

      const res = await fetch(`/api/dashboard/drivers?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      setDrivers(json.drivers);
      setPagination(json.pagination);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Couldn't load drivers.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset to page 1 whenever the search term changes.
  useEffect(() => {
    load(1, debouncedSearch);
  }, [debouncedSearch, load]);

  const goToPage = (p) => {
    if (p < 1 || p > pagination.totalPages) return;
    load(p, debouncedSearch);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 20,
          paddingBottom: 18,
          borderBottom: "1px solid #e9ecf0",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "#111827", margin: 0, letterSpacing: -0.3 }}>Drivers</h1>
          <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>
            {pagination.total > 0 ? `${pagination.total} driver${pagination.total === 1 ? "" : "s"} on file.` : "Fleet roster."}
          </p>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, carrier"
          style={{
            fontSize: 13,
            padding: "9px 13px",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            width: 260,
            maxWidth: "100%",
            outline: "none",
            color: "#111827",
          }}
        />
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
          Couldn&apos;t load drivers: {error}.{" "}
          <button
            onClick={() => load(pagination.page, debouncedSearch)}
            style={{ background: "none", border: "none", padding: 0, color: "#991b1b", fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}
          >
            Try again
          </button>
        </div>
      )}

      <div style={{ background: "white", border: "1px solid #edf0f3", borderRadius: 12, boxShadow: cardShadow, overflow: "hidden" }}>
        {/* column headers — hidden on narrow screens along with the columns themselves */}
        <div
          className="drv-col-hide-sm"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 18px",
            borderBottom: "1px solid #edf0f3",
            fontSize: 10.5,
            fontWeight: 600,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          <div style={{ width: 36 }} />
          <div style={{ flex: 1 }}>Driver</div>
          <div style={{ width: 120, flexShrink: 0 }}>Phone</div>
          <div style={{ width: 100, flexShrink: 0 }}>Email</div>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderBottom: i < 5 ? "1px solid #f1f3f5" : "none" }}>
              <DriverRowSkeleton />
            </div>
          ))
        ) : drivers.length === 0 ? (
          <div style={{ padding: "36px 18px", textAlign: "center", fontSize: 13, color: "#6b7280" }}>
            {debouncedSearch ? `No drivers match "${debouncedSearch}".` : "No drivers yet."}
          </div>
        ) : (
          drivers.map((d) => <DriverCard key={d.id} driver={d} />)
        )}

        <PaginationBar
          page={pagination.page}
          totalPages={pagination.totalPages}
          hasPrev={pagination.hasPrev}
          hasNext={pagination.hasNext}
          total={pagination.total}
          limit={pagination.limit}
          onChange={goToPage}
        />
      </div>

      <style jsx global>{`
        @keyframes drv-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .drv-row:hover {
          background: #fafbfc;
        }

        @media (max-width: 640px) {
          .drv-col-hide-sm {
            display: none !important;
          }
          .drv-inline-meta {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}