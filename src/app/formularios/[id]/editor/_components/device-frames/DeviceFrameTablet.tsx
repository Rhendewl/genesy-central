"use client";

import type { ReactNode } from "react";
import { useDeviceScale } from "./useDeviceScale";

// iPad Air proportions (CSS px)
const FRAME_W = 820;
const FRAME_H = 1180;

const BEZEL_TOP    = 28;
const BEZEL_SIDE   = 22;
const BEZEL_BOTTOM = 28;

const SCREEN_W = FRAME_W - BEZEL_SIDE * 2;
const SCREEN_H = FRAME_H - BEZEL_TOP - BEZEL_BOTTOM;

const STATUS_H  = 44;
const HOME_H    = 30;
const CONTENT_H = SCREEN_H - STATUS_H - HOME_H;

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 1;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function statusColor(bg: string) {
  return luminance(bg) > 0.5 ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
}

interface Props { children: ReactNode; bg: string }

export function DeviceFrameTablet({ children, bg }: Props) {
  const { containerRef, scale } = useDeviceScale(FRAME_W, FRAME_H);
  const sc = statusColor(bg);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div style={{ width: FRAME_W * scale, height: FRAME_H * scale, position: "relative", flexShrink: 0 }}>
        <div
          style={{
            position: "absolute", top: 0, left: 0,
            width: FRAME_W, height: FRAME_H,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >

          {/* ── Device body ── */}
          <div
            style={{
              width: FRAME_W, height: FRAME_H,
              borderRadius: 22,
              background: "linear-gradient(150deg, #2c2c2e 0%, #1c1c1e 100%)",
              position: "relative",
              boxShadow:
                "0 0 0 1.5px #48484a," +
                "inset 0 0 0 1px rgba(255,255,255,0.07)," +
                "0 50px 120px rgba(0,0,0,0.7)," +
                "0 10px 40px rgba(0,0,0,0.35)",
            }}
          >

            {/* ── Physical buttons ── */}
            {/* Power (top right) */}
            <div style={{ position: "absolute", right: -4, top: 140, width: 4, height: 45, background: "#48484a", borderRadius: "0 3px 3px 0" }} />
            {/* Volume up (right, below power) */}
            <div style={{ position: "absolute", right: -4, top: 220, width: 4, height: 38, background: "#48484a", borderRadius: "0 3px 3px 0" }} />
            {/* Volume down */}
            <div style={{ position: "absolute", right: -4, top: 268, width: 4, height: 38, background: "#48484a", borderRadius: "0 3px 3px 0" }} />

            {/* ── Front camera ── */}
            <div
              style={{
                position: "absolute",
                top: 13, left: "50%", transform: "translateX(-50%)",
                width: 10, height: 10,
                background: "#0a0a0a",
                borderRadius: "50%",
                boxShadow: "0 0 0 1.5px #2a2a2a",
              }}
            />

            {/* ── Screen ── */}
            <div
              style={{
                position: "absolute",
                top: BEZEL_TOP, left: BEZEL_SIDE,
                width: SCREEN_W, height: SCREEN_H,
                borderRadius: 8,
                background: bg,
                overflow: "hidden",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.2)",
              }}
            >

              {/* ── Status bar ── */}
              <div style={{ height: STATUS_H, position: "relative", background: bg, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 20px" }}>

                {/* Time */}
                <span
                  style={{
                    fontSize: 14, fontWeight: 700, color: sc,
                    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                  }}
                >
                  9:41
                </span>

                {/* Right icons */}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Signal */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5 }}>
                    {[5, 8, 11, 14].map((h, i) => (
                      <div key={i} style={{ width: 3, height: h, background: i < 3 ? sc : `${sc.replace("0.85", "0.25").replace("0.9", "0.25")}`, borderRadius: 1.5 }} />
                    ))}
                  </div>
                  {/* Battery */}
                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <div style={{ width: 24, height: 12, border: `1.5px solid ${sc}`, borderRadius: 3.5, padding: 2, display: "flex", alignItems: "center" }}>
                      <div style={{ flex: 1, height: "100%", background: sc, borderRadius: 1.5 }} />
                    </div>
                    <div style={{ width: 2, height: 5, background: sc, borderRadius: "0 1.5px 1.5px 0", marginLeft: 1 }} />
                  </div>
                </div>
              </div>

              {/* ── Content ── */}
              <div style={{ height: CONTENT_H, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {children}
              </div>

              {/* ── Home indicator ── */}
              <div style={{ height: HOME_H, display: "flex", alignItems: "center", justifyContent: "center", background: bg }}>
                <div style={{ width: 120, height: 4, background: sc, borderRadius: 3, opacity: 0.2 }} />
              </div>

            </div>{/* /screen */}
          </div>{/* /body */}
        </div>
      </div>
    </div>
  );
}
