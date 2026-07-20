"use client";

import { useState } from "react";

function emptyRow() {
  return { key: crypto.randomUUID(), unitNumber: "", currentOdometer: "" };
}

export default function RegisterTrucksPage() {
  const [rows, setRows] = useState([emptyRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  function updateRow(key, field, value) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResults(null);

    const trucks = rows.map((r) => ({
      unitNumber: r.unitNumber.trim(),
      currentOdometer: r.currentOdometer,
    }));

    if (trucks.every((t) => !t.unitNumber)) {
      setError("Enter at least one unit number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/trucks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trucks }),
      });
      const json = await res.json();
      if (!res.ok && !json.results) {
        throw new Error(json.error || `Request failed (${res.status})`);
      }
      setResults(json.results || []);

      const failedUnitNumbers = new Set(
        (json.results || []).filter((r) => !r.success).map((r) => r.unitNumber)
      );
      setRows((prev) => {
        const kept = prev.filter((r) => failedUnitNumbers.has(r.unitNumber.trim()));
        return kept.length > 0 ? kept : [emptyRow()];
      });
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{  minHeight: "100%" }} className="px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 3h15v13H1z" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-blue-900">Register Trucks</h1>
            <p className="text-sm text-blue-700">Add one truck, or several at once.</p>
          </div>
        </div>
        <p className="text-xs text-blue-500 mb-6 ml-[52px]">
          Use “Add another truck” below for each additional unit — you can submit them all together.
        </p>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-300 rounded-lg px-4 py-2.5 mb-4 font-medium">
            {error}
          </div>
        )}

        {results && (
          <div className="mb-5 space-y-1.5">
            {results.map((r, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-4 py-2 border font-medium ${
                  r.success
                    ? "bg-blue-100 border-blue-300 text-blue-800"
                    : "bg-red-50 border-red-300 text-red-700"
                }`}
              >
                {r.success ? "✓" : "✕"} Unit {r.unitNumber || "—"} — {r.success ? "registered" : r.error}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-col sm:flex-row sm:items-end gap-3 border border-blue-200 hover:border-blue-400 bg-blue-50/40 rounded-xl px-4 py-4 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-blue-800 mb-1.5 uppercase tracking-wide">
                  Unit number
                </label>
                <input
                  type="text"
                  value={row.unitNumber}
                  onChange={(e) => updateRow(row.key, "unitNumber", e.target.value)}
                  placeholder="e.g. 221"
                  className="w-full text-sm text-blue-950 placeholder-blue-300 bg-white border border-blue-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
              <div className="sm:w-36 flex-shrink-0">
                <label className="block text-xs font-semibold text-blue-800 mb-1.5 uppercase tracking-wide">
                  Odometer
                </label>
                <input
                  type="number"
                  value={row.currentOdometer}
                  onChange={(e) => updateRow(row.key, "currentOdometer", e.target.value)}
                  placeholder="0"
                  className="w-full text-sm text-blue-950 placeholder-blue-300 bg-white border border-blue-300 rounded-lg px-3 py-2.5 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                className="self-end sm:self-auto text-blue-400 hover:text-red-600 disabled:opacity-25 disabled:cursor-not-allowed px-2 py-2.5 transition-colors"
                title="Remove this row"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="w-full text-sm font-semibold text-blue-700 hover:text-blue-900 hover:bg-blue-50 border border-dashed border-blue-300 hover:border-blue-500 rounded-xl px-4 py-3 transition-colors"
          >
            + Add another truck
          </button>

          <div className="pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-7 py-3 shadow-sm shadow-blue-900/10 transition-colors"
            >
              {submitting ? "Registering…" : rows.length > 1 ? `Register ${rows.length} trucks` : "Register truck"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}