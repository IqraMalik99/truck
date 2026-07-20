"use client";

import { useCallback, useEffect, useState } from "react";
import MonthlyMilesChart from "../components/admin/MonthlyMilesChart";
import { UserIcon, TruckIcon, TrailerIcon, MilesIcon, PauseIcon, RefreshIcon } from "../components/admin/icons";

const TONES = {
  default: { bg: "#eef2f7", color: "#475569" },
  accent: { bg: "#dbeafe", color: "#2563eb" },
  warning: { bg: "#fef3c7", color: "#b45309" },
  success: { bg: "#dcfce7", color: "#16a34a" },
};

const cardShadow = "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)";

const shimmerStyle = {
  background: "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%)",
  backgroundSize: "400% 100%",
  animation: "dash-shimmer 1.4s ease infinite",
  borderRadius: 6,
};

function StatCard({ icon, label, value, tone = "default" }) {
  const t = TONES[tone];
  return (
    <div
      className="dash-stat-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "white",
        border: "1px solid #edf0f3",
        borderRadius: 12,
        padding: "16px 16px",
        boxShadow: cardShadow,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          minWidth: 42,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: t.bg,
          color: t.color,
        }}
      >
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ fontSize: 21, fontWeight: 700, color: "#111827", lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
          {value}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, background: "white", border: "1px solid #edf0f3", borderRadius: 12, padding: 16, boxShadow: cardShadow }}>
      <div style={{ ...shimmerStyle, width: 42, height: 42 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ ...shimmerStyle, width: 52, height: 20 }} />
        <div style={{ ...shimmerStyle, width: 80, height: 10 }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

const load = useCallback(async (isRefresh) => {
  isRefresh ? setRefreshing(true) : setLoading(true);
  setError(null);
  const controller = new AbortController();
  try {
    const res = await fetch("/api/dashboard", { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const json = await res.json();
    setData(json);
  } catch (err) {
    if (err.name !== "AbortError") {
      setError(err.message || "Couldn't load dashboard data.");
    }
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
  return () => controller.abort();
}, []);

useEffect(() => {
  load(false);
  const interval = setInterval(() => load(true), 60_000); // every 60s
  return () => clearInterval(interval);
}, [load]);

  const lastUpdated = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;

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
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "#111827", margin: 0, letterSpacing: -0.3 }}>Dashboard</h1>
          <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>Real-time overview, updated in real time.</p>
        </div>
        <div className="dash-header-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdated && <span style={{ fontSize: 11.5, color: "#94a3b8" }}>Updated {lastUpdated}</span>}
          <button
            className="dash-refresh-btn"
            onClick={() => load(true)}
            disabled={loading || refreshing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "#374151",
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 7,
              padding: "7px 13px",
              cursor: loading || refreshing ? "default" : "pointer",
              opacity: loading || refreshing ? 0.6 : 1,
              boxShadow: cardShadow,
            }}
          >
            <RefreshIcon width={14} height={14} style={{ animation: refreshing ? "dash-spin 0.8s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
          Couldn&apos;t load the dashboard: {error}.{" "}
          <button
            onClick={() => load(false)}
            style={{ background: "none", border: "none", padding: 0, color: "#991b1b", fontWeight: 600, textDecoration: "underline", cursor: "pointer", fontSize: 12.5 }}
          >
            Try again
          </button>
        </div>
      )}

      <div
        className="dash-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 14,
        }}
      >
        {loading || !data ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard icon={<UserIcon />} label="Total Drivers" value={data.totals.drivers} />
            <StatCard icon={<TruckIcon />} label="Total Trucks" value={data.totals.trucks} />
            <StatCard icon={<TrailerIcon />} label="Total Trailers" value={data.totals.trailers} />
            <StatCard icon={<MilesIcon />} label="Total Miles Today" value={data.totalMilesToday.toLocaleString()} tone="accent" />
            <StatCard icon={<PauseIcon />} label="Idle Trucks" value={data.idleTrucks} tone={data.idleTrucks > 0 ? "warning" : "success"} />
            <StatCard icon={<PauseIcon />} label="Idle Trailers" value={data.idleTrailers} tone={data.idleTrailers > 0 ? "warning" : "success"} />
          </>
        )}
      </div>

      <div className="dash-chart-card" style={{ background: "white", border: "1px solid #edf0f3", borderRadius: 12, padding: "20px 20px 16px", marginTop: 16, boxShadow: cardShadow }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 6 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>Miles this month</h2>
          {!loading && data && (
            <span style={{ fontSize: 11.5, color: "#6b7280" }}>
              {data.monthlyMiles.reduce((s, d) => s + d.miles, 0).toLocaleString()} mi total
            </span>
          )}
        </div>
        {loading || !data ? (
          <div style={{ ...shimmerStyle, height: 220, marginTop: 12 }} />
        ) : (
          <MonthlyMilesChart data={data.monthlyMiles} monthLabel={data.month.label} />
        )}
      </div>

      <style jsx global>{`
        @keyframes dash-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes dash-shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .dash-stat-card {
          transition: box-shadow 0.15s ease, transform 0.15s ease;
        }
        .dash-stat-card:hover {
          box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
          transform: translateY(-1px);
        }
        .dash-refresh-btn:hover:not(:disabled) {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        @media (max-width: 480px) {
          .dash-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
          .dash-chart-card {
            padding: 16px 14px 12px !important;
          }
          .dash-header-right {
            width: 100%;
            justify-content: space-between !important;
          }
        }

        @media (max-width: 340px) {
          .dash-stat-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}