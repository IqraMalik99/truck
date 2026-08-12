"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import DailyLogDashboard from "./DailyLogDashboard";

function todayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

// Small icons — kept inline so this file has zero extra deps.
function LogInIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}

function LogOutIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function SpinnerIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function initialsFrom(name, email) {
  const source = (name || "").trim() || (email || "").split("@")[0] || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function ProfileMenu({ user, signingOut, onSignOut }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onEscape(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const initials = initialsFrom(user?.name, user?.email);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-[#EF4444]/90 to-[#DC2626]/90 text-white text-[11px] sm:text-xs font-semibold ring-1 ring-white/50 shadow-[0_2px_10px_-2px_rgba(220,38,38,0.5)] hover:brightness-105 transition"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl bg-white/90 backdrop-blur-xl border border-white/70 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/5 overflow-hidden">
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {user?.name || "Driver"}
            </p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <div className="h-px bg-slate-200/70" />
          <button
            onClick={onSignOut}
            disabled={signingOut}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#991B1B] hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {signingOut ? <SpinnerIcon className="w-4 h-4" /> : <LogOutIcon className="w-4 h-4" />}
            {signingOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [dateLabel, setDateLabel] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  // next-auth's session status: "loading" | "authenticated" | "unauthenticated"
  const { data: session, status: authStatus } = useSession();

  async function handleSignOut() {
    setSigningOut(true);
    // callbackUrl sends the driver to /login after the session is cleared;
    // signOut() reloads the page itself, so signingOut resets on navigation
    await signOut({ callbackUrl: "/sign-in" });
  }

  useEffect(() => {
    setDateLabel(todayLabel());
  }, []);

  return (
    <div className="min-h-screen relative text-slate-900 font-sans antialiased">
      {/* Soft color field behind the page so the glass panel has something
          to actually blur/refract — a flat page bg would make the navbar
          read as just a translucent grey slab. */}
      <div
        aria-hidden
        className="fixed inset-0 -z-10 "
       
      ></div>

      {/* Floating glassmorphism navbar — minimal, narrow, scales down on mobile */}
      <div className="sticky top-3 sm:top-4 z-20 px-3 sm:px-4">
        <div className="max-w-md sm:max-w-2xl md:max-w-3xl mx-auto">
          <div className="rounded-3xl sm:rounded-full bg-white/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/60 shadow-[0_8px_32px_-12px_rgba(220,38,38,0.22)] ring-1 ring-black/5">
            <div className="px-3 py-2 sm:px-5 sm:py-2.5 flex items-center gap-3">
              {/* Brand mark — glassy red, not a flat solid fill */}
              <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-2xl bg-gradient-to-br from-[#EF4444]/90 to-[#DC2626]/90 backdrop-blur-md flex items-center justify-center shadow-[0_0_0_3px_rgba(220,38,38,0.15)] ring-1 ring-white/40">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 17V7a1 1 0 0 1 1-1h9v11" />
                  <path d="M13 10h4l4 4v3a1 1 0 0 1-1 1h-1" />
                  <circle cx="7.5" cy="17.5" r="1.75" />
                  <circle cx="17.5" cy="17.5" r="1.75" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.14em] text-[#DC2626] font-medium">
                  Daily Log
                </p>
                <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate text-slate-800">
                  {dateLabel ?? "\u00A0"}
                </h1>
              </div>

              {/* Auth control — Log In when signed out, avatar+dropdown when signed in */}
              <div className="shrink-0">
                {authStatus === "loading" && (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/50 animate-pulse" />
                )}

                {authStatus === "unauthenticated" && (
                  <a
                    href="/sign-in"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-[#EF4444]/90 to-[#DC2626]/90 backdrop-blur-md hover:from-[#F87171]/90 hover:to-[#EF4444]/90 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-[0_4px_14px_-4px_rgba(220,38,38,0.5)] ring-1 ring-white/40 transition"
                  >
                    <LogInIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Log In
                  </a>
                )}

                {authStatus === "authenticated" && (
                  <ProfileMenu
                    user={session?.user}
                    signingOut={signingOut}
                    onSignOut={handleSignOut}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <DailyLogDashboard />
      </main>
    </div>
  );
}