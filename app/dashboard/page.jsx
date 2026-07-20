"use client";

import { useState, useEffect } from "react";
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

export default function LogsPage() {
  const [dateLabel, setDateLabel] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  // next-auth's session status: "loading" | "authenticated" | "unauthenticated"
  const { status: authStatus } = useSession();

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
        className="fixed inset-0 -z-10 bg-[#F7F5F5]"
        style={{
          backgroundImage:
            "radial-gradient(60rem 30rem at 15% -10%, rgba(220,38,38,0.14), transparent 60%), radial-gradient(50rem 25rem at 100% 0%, rgba(248,113,113,0.12), transparent 55%)",
        }}
      />

      {/* Floating glassmorphism navbar */}
      <header className="sticky top-4 z-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[58px] bg-white/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/60 shadow-[0_8px_32px_-12px_rgba(220,38,38,0.22)] ring-1 ring-black/5">
            <div className="px-6 py-4 flex items-center gap-4">
              {/* Brand mark — glassy red, not a flat solid fill */}
              <div className="w-10 h-10 shrink-0 rounded-4xl bg-gradient-to-br from-[#EF4444]/90 to-[#DC2626]/90 backdrop-blur-md flex items-center justify-center shadow-[0_0_0_3px_rgba(220,38,38,0.15)] ring-1 ring-white/40">
                <svg
                  width="20"
                  height="20"
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
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#DC2626] font-medium">
                  Daily Log
                </p>
                <h1 className="text-xl font-semibold tracking-tight truncate text-slate-800">
                  {dateLabel ?? "\u00A0"}
                </h1>
              </div>

              {/* Auth button — Log In when signed out, Sign Out when signed in */}
              <div className="shrink-0">
                {authStatus === "loading" && (
                  <div className="w-[104px] h-9 rounded-full bg-white/50 animate-pulse" />
                )}

                {authStatus === "unauthenticated" && (
                  <a
                    href="/sign-in"
                    className="inline-flex items-center gap-2 text-sm font-medium text-white bg-gradient-to-r from-[#EF4444]/90 to-[#DC2626]/90 backdrop-blur-md hover:from-[#F87171]/90 hover:to-[#EF4444]/90 px-4 py-2 rounded-full shadow-[0_4px_14px_-4px_rgba(220,38,38,0.5)] ring-1 ring-white/40 transition"
                  >
                    <LogInIcon className="w-4 h-4" />
                    Log In
                  </a>
                )}

                {authStatus === "authenticated" && (
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#991B1B] bg-white/50 hover:bg-white/70 border border-white/70 hover:border-white disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2 rounded-full backdrop-blur-md transition"
                  >
                    {signingOut ? <SpinnerIcon className="w-4 h-4" /> : <LogOutIcon className="w-4 h-4" />}
                    {signingOut ? "Signing out…" : "Sign Out"}
                  </button>
                )}
              </div>
            </div>

            {/* Red glass edge — a soft gradient hairline, not a solid bar */}
            <div className="h-px mx-6 bg-gradient-to-r from-transparent via-[#DC2626]/40 to-transparent" />
            <div className="h-6" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <DailyLogDashboard />
      </main>
    </div>
  );
}