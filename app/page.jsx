"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
/* ---------------------------------------------------------------------
   THEME - white & red, kept at the top of this one file on purpose
--------------------------------------------------------------------- */
const RED = "#e31e24";
const RED_DARK = "#b8171c";
const INK = "#171717";
const GRAY = "#6b6b6f";
const LIGHT = "#f7f7f8";
const BORDER = "#ececec";
const FONT_HEAD = "'Oswald', sans-serif";
const FONT_BODY = "'Work Sans', sans-serif";

/* Swap this for whatever Unsplash (or your own) truck photo you like.
   Using Unsplash's dynamic resize params keeps it crisp + light. */
const HERO_BG_IMAGE =
  "https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=2000&q=80";

export const TRUCK_HERO_1 = "./images/Truck_Hero_1.png"

export const TRUCK_HERO_2 =
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=2000&q=80";

export const TRUCK_HERO_3 =
  "./images/Truch_Hero_2.png";
/* WhatsApp contact number, digits only (no +, no spaces) */
const WHATSAPP_NUMBER = "442089809731";

function scrollToContact() {
  const el = document.getElementById("contact");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------------------------------------------
   PAGE
--------------------------------------------------------------------- */
export default function Home() {
  return (
    <main style={{ backgroundColor: "#ffffff", color: INK, fontFamily: FONT_BODY, overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Work+Sans:wght@400;500;600;700;800&display=swap');
        html { scroll-behavior: smooth; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes waPulse {
          0% { box-shadow: 0 0 0 0 rgba(37,211,102,0.55); }
          70% { box-shadow: 0 0 0 16px rgba(37,211,102,0); }
          100% { box-shadow: 0 0 0 0 rgba(37,211,102,0); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
      <Navbar/>
      <HeroBanner />
      <FeaturesSection />
      <WavySection />
      <ContactSection />
      <WhatsAppButton />
    </main>
  );
}

/* ---------------------------------------------------------------------
   HERO BANNER - full-bleed photo background + outline-stroke headline
--------------------------------------------------------------------- */
function HeroBanner() {
  const wrapperRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);
  const [hoveredBtn, setHoveredBtn] = useState(null);

  useEffect(() => {
    function onScroll() {
      setScrollY(window.scrollY || 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // gentle parallax on the background image as you scroll
  const bgOffset = Math.min(scrollY * 0.25, 120);

  return (
    <section
      ref={wrapperRef}
      style={{ position: "relative", height: "100vh", minHeight: 620, width: "100%", overflow: "hidden" }}
      aria-label="Truck  logging platform intro"
    >
      {/* background photo */}
      <div
        style={{
          position: "absolute",
          inset: "-60px -0px",
          backgroundImage: `url(${HERO_BG_IMAGE})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          transform: `translateY(${bgOffset}px)`,
          willChange: "transform",
        }}
      />

      {/* dark-to-transparent overlay so text stays legible over the photo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(10,10,12,0.82) 0%, rgba(10,10,12,0.62) 38%, rgba(10,10,12,0.15) 65%, rgba(10,10,12,0.05) 100%)",
        }}
      />
      {/* subtle red wash at the very bottom for brand tie-in */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "35%",
          background: `linear-gradient(180deg, transparent 0%, ${RED_DARK}55 100%)`,
        }}
      />

      {/* content */}
      <div style={{ position: "relative", zIndex: 20, height: "100%", display: "flex", alignItems: "center" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", width: "100%", padding: "0 24px" }}>
          <div style={{ maxWidth: 620, display: "flex", flexDirection: "column", gap: 20 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(255,255,255,0.1)",
                color: "#fff",
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.35)",
                width: "fit-content",
                fontFamily: FONT_BODY,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                backdropFilter: "blur(4px)",
              }}
            >
              Built for Trucking Companies
            </span>

            <h1
              style={{
                fontFamily: FONT_HEAD,
                fontWeight: 700,
                fontSize: "clamp(34px, 5.2vw, 58px)",
                lineHeight: 1.08,
                letterSpacing: "-0.01em",
                margin: 0,
                color: "#fff",
              }}
            >
              Ditch the Paperwork.
              <br />
              Go{" "}
              <span
                style={{
                  color: "transparent",
                  WebkitTextStroke: "1.5px #ffffff",
                  fontWeight: 700,
                }}
              >
                Digital 
              </span>{" "}
              <span style={{ color: RED }}>Logging</span>.
            </h1>

            <p
              style={{
                fontFamily: FONT_BODY,
                fontSize: 18,
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.85)",
                margin: 0,
                maxWidth: 480,
              }}
            >
             Drivers log from the road. Admins get real-time insights across every driver, truck, and trailer.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, paddingTop: 6 }}>
              <button
                onClick={scrollToContact}
                onMouseEnter={() => setHoveredBtn("primary")}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  backgroundColor: RED,
                  color: "#fff",
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: 15,
                  padding: "15px 30px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  boxShadow: hoveredBtn === "primary" ? `0 14px 28px ${RED}55` : `0 6px 16px ${RED}40`,
                  transform: hoveredBtn === "primary" ? "translateY(-2px)" : "translateY(0)",
                  transition: "all 0.2s ease",
                }}
              >
                Start Free Trial
              </button>
              <button
                onClick={scrollToContact}
                onMouseEnter={() => setHoveredBtn("secondary")}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  backgroundColor: "transparent",
                  color: "#fff",
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: 15,
                  padding: "15px 30px",
                  borderRadius: 10,
                  border: `1.5px solid ${hoveredBtn === "secondary" ? RED : "rgba(255,255,255,0.5)"}`,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                See How It Works
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* scroll cue */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 20,
          color: "rgba(255,255,255,0.8)",
          fontSize: 12,
          fontFamily: FONT_BODY,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Scroll
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------
   FEATURES - what the platform actually does
--------------------------------------------------------------------- */
/* -- line icons, stroke-based, no emoji -- */
function IconClipboard({ color = RED }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <rect x="5" y="4.5" width="14" height="17" rx="2.4" stroke={color} strokeWidth="1.7" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function IconRadar({ color = RED }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.7" />
      <circle cx="12" cy="12" r="1.8" fill={color} />
      <path d="M12 12 17 7.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2" stroke={color} strokeWidth="1.4" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
function IconTruck({ color = RED }) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path d="M2.5 6.5h10.5v9.5H2.5z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M13 10h3.6l3.4 3.1v2.9h-7z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="6.5" cy="17.3" r="1.9" stroke={color} strokeWidth="1.7" />
      <circle cx="16.5" cy="17.3" r="1.9" stroke={color} strokeWidth="1.7" />
    </svg>
  );
}
function IconCheck({ color = RED }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill={`${color}14`} />
      <path d="M7.5 12.5 10.3 15.3 16.5 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FeaturesSection() {
  const features = [
    {
      Icon: IconClipboard,
      title: "Driver Daily Logging",
      description:
        "Drivers replace manual paper logs with quick digital entries for every shift — right from their phone, on the road.",
      points: ["Daily shift reports", "Works offline, syncs later"],
      image: `${TRUCK_HERO_1}`,
      offset: 0,
      rotate: -1.1,
    },
    {
      Icon: IconRadar,
      title: "Admin & Master Oversight",
      description:
        "Owners and dispatchers see every driver's daily and monthly reports in one place, no chasing paperwork.",
      points: ["All drivers, one dashboard", "Daily & monthly rollups", "Flag issues instantly"],
      image: `${TRUCK_HERO_2}&crop=focalpoint&fp-x=0.7`,
      offset: 44,
      rotate: 1.4,
    },
    {
      Icon: IconTruck,
      title: "Truck & Trailer Reports",
      description:
        "Track each truck and trailer's daily, monthly, and yearly history — mileage, condition, and maintenance in one record.",
      points: ["Per-vehicle history", "Trailer tracking included", "Yearly summaries for audits"],
      image: `${TRUCK_HERO_3}`,
      offset: 14,
      rotate: -0.6,
    },
  ];

  return (
    <section style={{ padding: "100px 24px 140px", backgroundColor: "#ffffff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 56px" }}>
          <span style={{ color: RED, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            The Platform
          </span>
          <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: "clamp(26px, 3.5vw, 40px)", margin: "10px 0 14px", color: INK }}>
            One System, Your Whole 
          </h2>
          <p style={{ color: GRAY, fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Everything a trucking company needs to move off paper — logging,
            oversight, and reporting — built to be customized to how you
            already operate.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 28,
            alignItems: "start",
          }}
        >
          {features.map((f, i) => (
            <FeatureCard key={f.title} {...f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ Icon, title, description, points, image, offset, rotate, index }) {
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        backgroundColor: "#ffffff",
        border: `1px solid ${hovered ? RED : BORDER}`,
        borderRadius: 20,
        padding: "0 28px 30px",
        marginTop: offset,
        boxShadow: hovered ? `0 24px 44px -14px ${RED}30` : "0 2px 10px rgba(17,17,17,0.04)",
        transform: `rotate(${rotate}deg) translateY(${hovered ? -6 : 0}px)`,
        transition: "box-shadow 0.3s cubic-bezier(0.34,1.56,0.64,1), transform 0.3s cubic-bezier(0.34,1.56,0.64,1), border-color 0.3s ease",
        overflow: "hidden",
        opacity: visible ? 1 : 0,
        animation: visible ? `fadeUp 0.7s ease ${index * 0.12}s both` : "none",
      }}
    >
      {/* photo banner */}
      <div style={{ margin: "0 -28px 0", height: 150, position: "relative", overflow: "hidden" }}>
        <img
          src={image}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, rgba(10,10,12,0.05) 0%, rgba(10,10,12,0.45) 100%)`,
          }}
        />
      </div>

     

      <h3
        style={{
          fontFamily: FONT_HEAD,
          fontWeight: 600,
          fontSize: 21,
          letterSpacing: "-0.01em",
          margin: "0 0 10px",
          color: INK,
        }}
      >
        {title}
      </h3>
      <p style={{ color: GRAY, fontSize: 15, lineHeight: 1.65, margin: "0 0 22px" }}>{description}</p>

      <div style={{ height: 1, background: BORDER, margin: "0 0 18px" }} />

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {points.map((pt) => (
          <li key={pt} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: INK }}>
            <IconCheck />
            {pt}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------
   WAVY SOLID SECTION - solid red, single clip-path wave (no seam)
--------------------------------------------------------------------- */
function WavySection() {
  return (
    <section style={{ position: "relative", padding: "0 24px" }}>
      {/* hidden SVG clipPath definition — this is what makes the red
          start immediately at the wave line, with nothing in between */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <clipPath id="wavyRedClip" clipPathUnits="objectBoundingBox">
            <path d="M0,0.05 C0.16,0.12 0.32,0 0.5,0.055 C0.68,0.11 0.84,0.01 1,0.04 L1,0.95 C0.84,0.88 0.68,1 0.5,0.945 C0.32,0.89 0.16,1 0,0.955 Z" />
          </clipPath>
        </defs>
      </svg>

      <div
        style={{
          backgroundColor: RED,
          clipPath: "url(#wavyRedClip)",
          padding: "170px 24px 190px",
          position: "relative",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            position: "relative",
            zIndex: 2,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 48,
            alignItems: "center",
          }}
          className="wavy-grid"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18, color: "#fff" }}>
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.85 }}>
              From Manual to Digital
            </span>
            <h2 style={{ fontFamily: FONT_HEAD, fontWeight: 700, fontSize: "clamp(26px, 3.5vw, 40px)", margin: 0 }}>
              Built Around How Trucking Actually Runs
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, opacity: 0.9, margin: 0, maxWidth: 520 }}>
              Every  is different. trucker adapts to your workflows
              instead of forcing you into ours — add the fields, approvals,
              and reports your company actually needs.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 12 }}>
              {[
                { t: "Custom Workflows", d: "Design your own logging paths per cargo type or route." },
                { t: "Yearly Roll-Ups", d: "Every truck and trailer, summarized by month and year." },
                { t: "API Hub", d: "Connect to the ERP or TMS you already use." },
              ].map((c) => (
                <div key={c.t} style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 14, padding: 18 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6, fontFamily: FONT_HEAD, letterSpacing: "0.01em" }}>{c.t}</div>
                  <div style={{ fontSize: 13.5, opacity: 0.85, lineHeight: 1.5 }}>{c.d}</div>
                </div>
              ))}
            </div>

            <button
              onClick={scrollToContact}
              style={{
                marginTop: 10,
                width: "fit-content",
                backgroundColor: "#ffffff",
                color: RED,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 15,
                padding: "15px 30px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
            >
              Configure Your Solution
            </button>
          </div>
        </div>
      </div>

      <style>{`@media (min-width: 900px) { .wavy-grid { grid-template-columns: 1.1fr 0.9fr; } }`}</style>
    </section>
  );
}

/* ---------------------------------------------------------------------
   CONTACT - layered "3D" card
--------------------------------------------------------------------- */
function ContactSection() {
  return (
    <section
      id="contact"
      style={{
        padding: "70px 24px 90px",
        backgroundColor: LIGHT,
      }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            textAlign: "center",
            maxWidth: 500,
            margin: "0 auto 42px",
          }}
        >
          <span
            style={{
              color: RED,
              fontFamily: FONT_BODY,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Talk to Us
          </span>

          <h2
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: 700,
              fontSize: "clamp(28px,3vw,40px)",
              margin: "12px 0",
              color: INK,
              lineHeight: 1.2,
            }}
          >
            Ready to Retire the Paper Logs?
          </h2>

          <p
            style={{
              color: GRAY,
              fontSize: 16,
              lineHeight: 1.7,
              margin: 0,
            }}
          >
            Tell us about your fleet and we'll schedule a personalized demo.
          </p>
        </div>

        {/* Card */}
        <div
          className="contact-card"
          style={{
            background: "#fff",
            borderRadius: 24,
            border: `1px solid ${BORDER}`,
            boxShadow: "0 20px 50px rgba(17,17,17,.08)",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1fr",
            maxWidth: 860,
            margin: "0 auto",
          }}
        >
          {/* Left Side */}
          <div
            style={{
              background: `linear-gradient(155deg, ${RED}, ${RED_DARK})`,
              color: "#fff",
              padding: 36,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h3
                style={{
                  fontFamily: FONT_HEAD,
                  fontSize: 24,
                  marginBottom: 14,
                }}
              >
                Get in Touch
              </h3>

              <p
                style={{
                  opacity: 0.9,
                  lineHeight: 1.7,
                  marginBottom: 28,
                  fontSize: 15,
                }}
              >
                We'll help you move from paper logs to a fully digital fleet
                management workflow.
              </p>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                <ContactRow
                  label="Call Us"
                  value="+44 20 8980 9731"
                />
                <ContactRow
                  label="Email"
                  value="info@trucker.com"
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 40,
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                opacity: .8,
              }}
            >
              Trusted by fleets nationwide
            </div>
          </div>

          {/* Right Side */}
          <div
            style={{
              padding: 36,
            }}
          >
            <form
              onSubmit={(e) => e.preventDefault()}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              <div className="form-row">
                <Field
                  label="Full Name"
                  placeholder="John Smith"
                />

                <Field
                  label="Company Name"
                  placeholder="Smith Trucking Co."
                />
              </div>

              <Field
                label="Work Email"
                placeholder="john@company.com"
                type="email"
              />

              <Field
                label="Fleet Size"
                placeholder="e.g. 25 trucks"
              />

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: 8,
                    fontWeight: 700,
                    color: GRAY,
                    fontSize: 13,
                  }}
                >
                  Message
                </label>

                <textarea
                  rows={4}
                  placeholder="Tell us about your fleet..."
                  style={{
                    width: "100%",
                    background: LIGHT,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 14,
                    padding: "15px 18px",
                    fontFamily: FONT_BODY,
                    fontSize: 15,
                    resize: "vertical",
                    outline: "none",
                  }}
                />
              </div>

              <SubmitButton />
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .form-row{
          display:grid;
          grid-template-columns:1fr;
          gap:16px;
        }

        @media (min-width:860px){
          .contact-card{
            grid-template-columns:340px 1fr;
          }

          .form-row{
            grid-template-columns:1fr 1fr;
          }
        }
      `}</style>
    </section>
  );
}

function ContactRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{value}</div>
    </div>
  );
}

function Field({ label, placeholder, type = "text" }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 700, color: GRAY, display: "block", marginBottom: 6 }}>{label}</label>
      <input
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          backgroundColor: focused ? "#fff" : LIGHT,
          border: `1px solid ${focused ? RED : BORDER}`,
          borderRadius: 12,
          padding: "13px 16px",
          outline: "none",
          fontFamily: FONT_BODY,
          fontSize: 15,
          transition: "all 0.15s ease",
        }}
        placeholder={placeholder}
        type={type}
      />
    </div>
  );
}

function SubmitButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      type="submit"
      style={{
        marginTop: 4,
        backgroundColor: RED,
        color: "#fff",
        fontFamily: FONT_BODY,
        fontWeight: 700,
        fontSize: 15,
        padding: "16px 0",
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        boxShadow: hovered ? `0 16px 30px ${RED}40` : `0 8px 20px ${RED}25`,
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        transition: "all 0.2s ease",
      }}
    >
      Send Inquiry
    </button>
  );
}

/* ---------------------------------------------------------------------
   FLOATING WHATSAPP BUTTON
--------------------------------------------------------------------- */
function WhatsAppButton() {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        bottom: 26,
        right: 26,
        zIndex: 50,
        width: 58,
        height: 58,
        borderRadius: "50%",
        backgroundColor: "#25D366",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 24px rgba(0,0,0,0.25)",
        animation: "waPulse 2.4s infinite",
        transform: hovered ? "scale(1.08)" : "scale(1)",
        transition: "transform 0.2s ease",
        textDecoration: "none",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff">
        <path d="M12.02 2C6.5 2 2.03 6.47 2.03 12c0 1.85.5 3.58 1.36 5.07L2 22l5.08-1.33A9.94 9.94 0 0 0 12.02 22C17.53 22 22 17.53 22 12S17.53 2 12.02 2Zm0 18.1c-1.65 0-3.18-.48-4.47-1.32l-.32-.2-3.02.79.81-2.94-.21-.3A8.08 8.08 0 0 1 3.93 12c0-4.47 3.63-8.1 8.09-8.1 4.46 0 8.08 3.63 8.08 8.1 0 4.47-3.62 8.1-8.08 8.1Zm4.44-6.06c-.24-.12-1.43-.7-1.65-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.42-1.33-1.66-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.81-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.15-.06-.1-.22-.16-.46-.28Z" />
      </svg>
    </a>
  );
}