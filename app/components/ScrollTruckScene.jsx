"use client";



import { useEffect, useRef, useState } from "react";
import { colors, spacing, fonts, fontSizes, containerStyle } from "../lib/theme";

const SCROLL_LENGTH_VH = 200;
const TRUCK_IMAGE_SRC = "./truck.png";

export default function ScrollTruckScene() {
  const wrapperRef = useRef(null);
  const truckRef = useRef(null);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 });
  const [hoveredBtn, setHoveredBtn] = useState(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    function updateScroll() {
      const rect = wrapper.getBoundingClientRect();
      const scrollDistance = rect.height - window.innerHeight;
      const progress =
        scrollDistance > 0
          ? Math.min(Math.max(-rect.top / scrollDistance, 0), 1)
          : 0;
      setScrollProgress(progress);
    }

    function handleMouseMove(e) {
      const el = truckRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (window.innerWidth / 2);
      const dy = (e.clientY - cy) / (window.innerHeight / 2);
      setMouseTilt({ x: dx, y: dy });
    }

    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    updateScroll();

    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // --- Scroll-driven "drive in" motion ---
  const driveInProgress = Math.min(scrollProgress / 0.7, 1); // settle by 70% through the section
  const translateX = (1 - driveInProgress) * -55; // vw: starts off-screen left
  const scale = 0.55 + driveInProgress * 0.55; // grows from distant to full size
  const opacity = Math.min(scrollProgress / 0.15, 1); // fade in quickly

  // --- Mouse-driven tilt/parallax (only meaningful once mostly settled) ---
  const tiltStrength = driveInProgress;
  const rotateY = mouseTilt.x * 10 * tiltStrength;
  const rotateX = -mouseTilt.y * 6 * tiltStrength;
  const driftX = mouseTilt.x * 14 * tiltStrength;
  const driftY = mouseTilt.y * 8 * tiltStrength;

  // subtle continuous idle bob, layered on top
  const idleBob = Math.sin(scrollProgress * Math.PI * 4) * 6 * driveInProgress;

  return (
    <section
      ref={wrapperRef}
      style={{ height: `${SCROLL_LENGTH_VH}vh`, position: "relative" }}
      aria-label="LOGIVER fleet intro banner"
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          width: "100%",
          overflow: "hidden",
          background: `linear-gradient(to bottom, ${colors.surface}, ${colors.surfaceContainerLow}, ${colors.surfaceContainer})`,
        }}
      >
        {/* Ground / horizon line to sell depth */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "28%",
            background: `linear-gradient(to top, ${colors.surfaceContainerHighest}cc, transparent)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "18%",
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: `${colors.outlineVariant}66`,
          }}
        />

        {/* Copy */}
        <div
          style={{
            pointerEvents: "none",
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div style={{ ...containerStyle(), width: "100%" }}>
            <div style={{ pointerEvents: "auto", maxWidth: 576, display: "flex", flexDirection: "column", gap: spacing.stackMd }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: `${colors.primary}1a`,
                  color: colors.primary,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  border: `1px solid ${colors.primary}33`,
                  width: "fit-content",
                }}
              >
                <span style={{ ...fontSizes.labelSm, fontFamily: fonts.label, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Next-Gen Logistics
                </span>
              </div>
              <h1 style={{ ...fontSizes.displayLg, fontFamily: fonts.display, color: colors.onBackground, margin: 0 }}>
                Digitize Your <span style={{ color: colors.primary }}>Fleet Management</span>
              </h1>
              <p style={{ ...fontSizes.bodyLg, fontFamily: fonts.body, color: "#5d5e61", maxWidth: 512, margin: 0 }}>
                From manual reports to seamless software logging. Streamline
                every mile with industrial-grade precision and real-time
                analytics.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: spacing.stackMd, paddingTop: spacing.base }}>
                <button
                  onMouseEnter={() => setHoveredBtn("primary")}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    backgroundColor: colors.primary,
                    color: "#ffffff",
                    fontWeight: 600,
                    padding: "16px 32px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: hoveredBtn === "primary" ? "0 10px 25px rgba(227,30,36,0.3)" : "0 4px 6px rgba(0,0,0,0.1)",
                    transition: "box-shadow 0.2s ease",
                  }}
                >
                  Start Free Trial
                </button>
                <button
                  onMouseEnter={() => setHoveredBtn("secondary")}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    backgroundColor: hoveredBtn === "secondary" ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.6)",
                    color: colors.onSurface,
                    fontWeight: 600,
                    padding: "16px 32px",
                    borderRadius: 12,
                    border: `1px solid ${colors.outlineVariant}4d`,
                    cursor: "pointer",
                    backdropFilter: "blur(4px)",
                    transition: "background-color 0.2s ease",
                  }}
                >
                  View Demo
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Ground shadow beneath the truck */}
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            borderRadius: 9999,
            backgroundColor: "rgba(20,29,35,0.2)",
            filter: "blur(20px)",
            width: "38vw",
            height: "3vw",
            left: "58%",
            bottom: "20%",
            transform: `translate(-50%, 0) scale(${0.6 + driveInProgress * 0.4})`,
            opacity: opacity * 0.6,
            transition: "transform 0.05s linear",
          }}
        />

        {/* The truck itself */}
        <div
          ref={truckRef}
          style={{
            position: "absolute",
            zIndex: 10,
            left: "58%",
            top: "48%",
            width: "min(60vw, 780px)",
            transform: `
              translate(-50%, -50%)
              translateX(${translateX + driftX}px)
              translateY(${driftY + idleBob}px)
              scale(${scale})
              perspective(800px)
              rotateY(${rotateY}deg)
              rotateX(${rotateX}deg)
            `,
            opacity,
            transition: "opacity 0.2s linear",
            willChange: "transform",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={TRUCK_IMAGE_SRC}
            alt="LOGIVER-ready freight truck"
            style={{
              width: "100%",
              height: "auto",
              filter: "drop-shadow(0 25px 25px rgba(0,0,0,0.25))",
              userSelect: "none",
              pointerEvents: "none",
            }}
            draggable={false}
          />
        </div>
      </div>
    </section>
  );
}