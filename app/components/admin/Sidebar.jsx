"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "grid" },
  { href: "/admin/drivers", label: "Drivers", icon: "user" },
  { href: "/admin/trucks", label: "Trucks", icon: "truck" },
  { href: "/admin/trailers", label: "Trailers", icon: "box" },
  { href: "/admin/trucks/create", label: "Truck Create", icon: "truck" },
  { href: "/admin/trailers/create", label: "Trailers Create", icon: "box" },
];

function Icon({ name }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "grid":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
        </svg>
      );
    case "truck":
      return (
        <svg {...common}>
          <rect x="1" y="7" width="13" height="9" rx="1" />
          <path d="M14 10h4l3 3v3h-7z" />
          <circle cx="6" cy="18" r="1.6" />
          <circle cx="17" cy="18" r="1.6" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="M3 8l9-5 9 5-9 5-9-5z" />
          <path d="M3 8v9l9 5 9-5V8" />
          <path d="M12 13v9" />
        </svg>
      );
    default:
      return null;
  }
}

function MenuIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

function SignOutIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the drawer whenever the route changes (e.g. tapping a nav link).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // redirect: false lets us control navigation explicitly.
      await signOut({ redirect: false });
    } finally {
      router.push("/sign-in");
    }
  }

  return (
    <>
      <button
        className="dash-hamburger"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 40,
          width: 38,
          height: 38,
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          background: "white",
          color: "#111827",
          display: "none",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 2px rgba(15,23,42,0.06)",
        }}
      >
        <MenuIcon />
      </button>

      {open && (
        <div
          className="dash-overlay"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.4)",
            zIndex: 45,
          }}
        />
      )}

      <aside
        className={`dash-sidebar ${open ? "dash-sidebar-open" : ""}`}
        style={{
          width: 220,
          minWidth: 220,
          height: "100vh",
          position: "sticky",
          top: 0,
          display: "flex",
          flexDirection: "column",
          background: "#0b1220",
          borderRight: "1px solid #1c2536",
          color: "#cbd5e1",
          fontSize: 13,
        }}
      >
        <button
          className="dash-close"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          style={{
            display: "none",
            alignSelf: "flex-end",
            margin: "10px 10px 0 0",
            width: 30,
            height: 30,
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: "#94a3b8",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CloseIcon />
        </button>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "14px 10px", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  borderLeft: active ? "2px solid #2563eb" : "2px solid transparent",
                  background: active ? "#131c2e" : "transparent",
                  color: active ? "#ffffff" : "#94a3b8",
                }}
              >
                <span style={{ display: "flex", width: 16, height: 16 }}>
                  <Icon name={item.icon} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "14px 18px", borderTop: "1px solid #1c2536" }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, color: "#475569" }}>
            Signed in as
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#e2e8f0", marginTop: 2 }}>
            {session?.user?.name || session?.user?.email || "Admin"}
          </div>

          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              marginTop: 12,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid #1f2937",
              background: "transparent",
              color: signingOut ? "#475569" : "#94a3b8",
              fontSize: 12.5,
              fontWeight: 500,
              cursor: signingOut ? "default" : "pointer",
            }}
          >
            <SignOutIcon />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      <style jsx global>{`
        @media (max-width: 768px) {
          .dash-hamburger {
            display: flex !important;
          }
          .dash-close {
            display: flex !important;
          }
          .dash-sidebar {
            position: fixed !important;
            top: 0;
            left: 0;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }
          .dash-sidebar-open {
            transform: translateX(0);
          }
          /* Guarantees clearance below the fixed hamburger button even if
             the page/layout wrapping this Sidebar doesn't add its own
             top padding on mobile. */
          body {
            padding-top: 56px;
          }
        }
      `}</style>
    </>
  );
}