"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/*
  Drop-in replacement for a plain <select>.
  Usage:
    <SearchableSelect
      value={stateCode}
      onChange={setStateCode}
      options={US_STATES.map(s => ({ value: s.code, label: `${s.name} (${s.code})` }))}
      placeholder="Select state"
    />
*/
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openList() {
    setOpen(true);
    setHighlight(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function pick(opt) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight]) pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {!open && (
        <button
          type="button"
          onClick={openList}
          className="w-full flex items-center justify-between border border-slate-300 rounded-lg px-3 py-2 text-sm text-left bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
        >
          <span className={selected ? "text-slate-900" : "text-slate-400"}>
            {selected ? selected.label : placeholder}
          </span>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="text-slate-400 shrink-0 ml-2">
            <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {open && (
        <div className="relative">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={selected ? selected.label : placeholder}
            className="w-full border border-[#F97316] rounded-lg px-3 py-2 text-sm focus:outline-none ring-2 ring-[#F97316]/30"
          />
          <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">No matches</li>
            )}
            {filtered.map((opt, i) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(opt)}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    i === highlight ? "bg-[#F97316]/10 text-[#9A3412]" : "text-slate-700"
                  } ${opt.value === value ? "font-semibold" : ""}`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}