"use client";

import { useSearchParams } from "next/navigation";
import MonthlyLogDashboard from "../../../components/admin/Monthlylogdashboard";

// /admin/drivers/query?id=<driverId>
// The id comes from the query string (not a route param), so we read it
// with useSearchParams and hand it straight to MonthlyLogDashboard, which
// fetches /api/daily-log/[driverId]/month using that id.
export default function AdminDriverQueryPage() {
  const searchParams = useSearchParams();
  const driverId = searchParams.get("id");

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="max-w-3xl mx-auto mb-5">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-800">Driver logs</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          {driverId ? "Monthly duty status and trip history for this driver." : "No driver id provided in the URL."}
        </p>
      </div>
      <MonthlyLogDashboard driverId={driverId} />
    </div>
  );
}