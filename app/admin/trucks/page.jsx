"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TruckIcon } from "../../components/admin/icons";

const cardShadow = "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 1px rgba(15, 23, 42, 0.03)";

function StatusBadge({ status }) {
  const isAvailable = status === "available";
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: isAvailable ? "#dcfce7" : "#fef3c7", color: isAvailable ? "#16a34a" : "#b45309" }}>
      {isAvailable ? "Available" : "In use"}
    </span>
  );
}

function IconButton({ onClick, label, variant = "default", children }) {
  const colors = {
    default: { color: "#475569", hoverBg: "#eef2f7" },
    danger: { color: "#b91c1c", hoverBg: "#fef2f2" },
  }[variant];
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #e5e7eb", background: hover ? colors.hoverBg : "white", color: colors.color, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.12s ease" }}
    >
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SpinnerIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.7s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function Modal({ onClose, children, width = 340 }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width, maxWidth: "100%", background: "white", borderRadius: 12, padding: 20, boxShadow: "0 20px 40px rgba(15,23,42,0.18)" }}>
        {children}
      </div>
    </div>
  );
}

function AddTruckModal({ onClose, onCreated }) {
  const [unitNumber, setUnitNumber] = useState("");
  const [currentOdometer, setCurrentOdometer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!unitNumber.trim()) {
      setError("Enter a unit number");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/trucks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitNumber: unitNumber.trim(), currentOdometer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't add truck");
      onCreated(data.truck);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 14px" }}>Add truck</h2>
        <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 6 }}>Unit number</label>
        <input
          autoFocus
          value={unitNumber}
          onChange={(e) => setUnitNumber(e.target.value)}
          placeholder="e.g. 118"
          style={{ width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
        />
        <label style={{ fontSize: 12, color: "#6b7280", display: "block", margin: "12px 0 6px" }}>Current odometer (optional)</label>
        <input
          type="number"
          value={currentOdometer}
          onChange={(e) => setCurrentOdometer(e.target.value)}
          placeholder="e.g. 84200"
          style={{ width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
        />
        {error && <p style={{ fontSize: 12, color: "#b91c1c", margin: "8px 0 0" }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ fontSize: 13, fontWeight: 600, color: "#374151", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", cursor: saving ? "default" : "pointer" }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ fontSize: 13, fontWeight: 600, color: "white", background: "#DC2626", border: "none", borderRadius: 8, padding: "8px 16px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {saving && <SpinnerIcon />}
            {saving ? "Adding…" : "Add truck"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditTruckModal({ truck, onClose, onSaved }) {
  const [unitNumber, setUnitNumber] = useState(truck.unitNumber);
  const [currentOdometer, setCurrentOdometer] = useState(truck.currentOdometer ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!unitNumber.trim()) {
      setError("Enter a unit number");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/trucks/edit/${truck._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitNumber: unitNumber.trim(), currentOdometer }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save changes");
      onSaved(data.truck);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={submit}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 14px" }}>Edit truck</h2>
        <label style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 6 }}>Unit number</label>
        <input
          autoFocus
          value={unitNumber}
          onChange={(e) => setUnitNumber(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
        />
        <label style={{ fontSize: 12, color: "#6b7280", display: "block", margin: "12px 0 6px" }}>Current odometer</label>
        <input
          type="number"
          value={currentOdometer}
          onChange={(e) => setCurrentOdometer(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
        />
        {error && <p style={{ fontSize: 12, color: "#b91c1c", margin: "8px 0 0" }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ fontSize: 13, fontWeight: 600, color: "#374151", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", cursor: saving ? "default" : "pointer" }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ fontSize: 13, fontWeight: 600, color: "white", background: "#DC2626", border: "none", borderRadius: 8, padding: "8px 16px", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
            {saving && <SpinnerIcon />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteTruckModal({ truck, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/trucks/edit/${truck._id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't delete truck");
      onDeleted(truck._id);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Delete Unit {truck.unitNumber}?</h2>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 4px", lineHeight: 1.5 }}>
        This can't be undone. Past trips that used this truck will keep their records.
      </p>
      {error && <p style={{ fontSize: 12, color: "#b91c1c", margin: "10px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <button type="button" onClick={onClose} disabled={deleting} style={{ fontSize: 13, fontWeight: 600, color: "#374151", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 14px", cursor: deleting ? "default" : "pointer" }}>
          Cancel
        </button>
        <button type="button" onClick={confirmDelete} disabled={deleting} style={{ fontSize: 13, fontWeight: 600, color: "white", background: "#7F1D1D", border: "none", borderRadius: 8, padding: "8px 16px", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}>
          {deleting && <SpinnerIcon />}
          {deleting ? "Deleting…" : "Delete truck"}
        </button>
      </div>
    </Modal>
  );
}

export default function TrucksPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState("");

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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCreated() {
    load(page);
    setToast("Truck added");
  }

  function handleSaved(updated) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            trucks: prev.trucks.map((t) =>
              t._id === updated._id ? { ...t, unitNumber: updated.unitNumber, currentOdometer: updated.currentOdometer } : t
            ),
          }
        : prev
    );
    setToast("Truck updated");
  }

  function handleDeleted(id) {
    const wasOnlyRow = data?.trucks?.length === 1 && page > 1;
    if (wasOnlyRow) {
      setPage((p) => p - 1);
    } else {
      load(page);
    }
    setToast("Truck deleted");
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, paddingBottom: 18, borderBottom: "1px solid #e9ecf0" }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, color: "#111827", margin: 0 }}>Trucks</h1>
          <p style={{ fontSize: 12.5, color: "#6b7280", margin: "4px 0 0" }}>Real-time status and per-truck monthly reports.</p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "white", background: "#DC2626", border: "none", borderRadius: 8, padding: "9px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          <PlusIcon />
          Add truck
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 12.5, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading || !data
          ? Array.from({ length: 5 }).map((_, i) => <div key={i} style={{ height: 62, borderRadius: 10, background: "#f3f4f6" }} />)
          : data.trucks.length === 0
          ? (
            <div style={{ textAlign: "center", padding: "48px 16px", color: "#9ca3af", fontSize: 13 }}>
              No trucks yet — add one to get started.
            </div>
          )
          : data.trucks.map((t) => (
              <div
                key={t._id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "white", border: "1px solid #edf0f3", borderRadius: 10, padding: "14px 16px", boxShadow: cardShadow }}
              >
                <Link
                  href={`/admin/trucks/${t._id}`}
                  style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#eef2f7", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", flexShrink: 0 }}>
                    <TruckIcon />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Unit {t.unitNumber}</p>
                    <p style={{ fontSize: 11.5, color: "#6b7280", margin: "2px 0 0" }}>
                      {t.currentOdometer != null ? `${t.currentOdometer.toLocaleString()} mi` : "No odometer on file"}
                    </p>
                  </div>
                </Link>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <StatusBadge status={t.status} />
                  <IconButton label="Edit truck" onClick={() => setEditTarget(t)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    label={t.status === "in_use" ? "Can't delete — truck is in use" : "Delete truck"}
                    variant="danger"
                    onClick={() => t.status !== "in_use" && setDeleteTarget(t)}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </div>
            ))}
      </div>

      {data && data.totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 20 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", background: "white", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.5 : 1 }}>
            Previous
          </button>
          <span style={{ fontSize: 12.5, color: "#6b7280" }}>Page {data.page} of {data.totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", background: "white", border: "1px solid #e5e7eb", borderRadius: 7, padding: "6px 12px", cursor: page === data.totalPages ? "default" : "pointer", opacity: page === data.totalPages ? 0.5 : 1 }}>
            Next
          </button>
        </div>
      )}

      {addOpen && <AddTruckModal onClose={() => setAddOpen(false)} onCreated={handleCreated} />}
      {editTarget && <EditTruckModal truck={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />}
      {deleteTarget && <DeleteTruckModal truck={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "#111827", color: "white", fontSize: 12.5, fontWeight: 500, padding: "9px 16px", borderRadius: 999, boxShadow: "0 8px 20px rgba(0,0,0,0.2)", zIndex: 60 }}>
          {toast}
        </div>
      )}
    </div>
  );
}