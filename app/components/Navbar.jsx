"use client";

import { useEffect, useState } from "react";

/* ---------------------------------------------------------------------
   THEME - matches the rest of the site (kept local so this file drops
   in standalone)
--------------------------------------------------------------------- */
const RED = "#e31e24";
const RED_DARK = "#b8171c";
const INK = "#171717";
const BORDER = "#ececec";
const FONT_HEAD = "'Oswald', sans-serif";
const FONT_BODY = "'Work Sans', sans-serif";

/* ---------------------------------------------------------------------
   ICONS
--------------------------------------------------------------------- */
function IconTruckMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M2.5 6.5h10.5v9.5H2.5z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M13 10h3.6l3.4 3.1v2.9h-7z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="6.5" cy="17.3" r="1.9" fill="#fff" />
      <circle cx="16.5" cy="17.3" r="1.9" fill="#fff" />
    </svg>
  );
}

function IconUser({ color = RED }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.6" stroke={color} strokeWidth="1.8" />
      <path d="M4.8 19.5c1.4-3.3 4.2-5 7.2-5s5.8 1.7 7.2 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------------------------------------------------------------
   NAVBAR
--------------------------------------------------------------------- */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [signUpHover, setSignUpHover] = useState(false);
  const [loginHover, setLoginHover] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: "background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease",
        backgroundColor: scrolled ? "rgba(255,255,255,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(10px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(10px)" : "none",
        borderBottom: `1px solid ${scrolled ? BORDER : "transparent"}`,
        boxShadow: scrolled ? "0 6px 24px rgba(17,17,17,0.06)" : "none",
      }}
    >
      <nav
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          height: 76,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: FONT_BODY,
        }}
      >
        {/* logo */}
        <a
          href="/"
          style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: `linear-gradient(155deg, ${RED}, ${RED_DARK})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 6px 16px ${RED}40`,
              flexShrink: 0,
            }}
          >
            <IconTruckMark />
          </span>
          <span
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: 700,
              fontSize: 21,
              letterSpacing: "-0.01em",
              color: scrolled ? INK : "#fff",
              transition: "color 0.3s ease",
            }}
          >
            trucker<span style={{ color: RED }}>.</span>
          </span>
        </a>

        {/* auth actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/sign-in"
            onMouseEnter={() => setLoginHover(true)}
            onMouseLeave={() => setLoginHover(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 14px",
              borderRadius: 9,
              fontSize: 14.5,
              fontWeight: 700,
              textDecoration: "none",
              color: scrolled ? INK : "#fff",
              backgroundColor: loginHover ? (scrolled ? "#f3f3f4" : "rgba(255,255,255,0.14)") : "transparent",
              transition: "background-color 0.2s ease",
            }}
          >
            <IconUser color={scrolled ? RED : "#fff"} />
            Login
          </a>

          <a
            href="/sign-up"
            onMouseEnter={() => setSignUpHover(true)}
            onMouseLeave={() => setSignUpHover(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              backgroundColor: RED,
              color: "#fff",
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 14.5,
              padding: "11px 22px",
              borderRadius: 9,
              textDecoration: "none",
              boxShadow: signUpHover ? `0 12px 22px ${RED}50` : `0 5px 14px ${RED}35`,
              transform: signUpHover ? "translateY(-2px)" : "translateY(0)",
              transition: "all 0.2s ease",
            }}
          >
            Sign Up
          </a>
        </div>
      </nav>
    </header>
  );
}