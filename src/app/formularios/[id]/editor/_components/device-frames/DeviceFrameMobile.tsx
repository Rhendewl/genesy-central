"use client";

import type { ReactNode } from "react";
import { useDeviceScale } from "./useDeviceScale";

// iPhone 15 Pro proportions (CSS px)
const FRAME_W = 393;
const FRAME_H = 852;

// Screen inset from body edges
const INSET = 12;
const SCREEN_W = FRAME_W - INSET * 2;
const SCREEN_H = FRAME_H - INSET * 2;

const STATUS_H  = 59;
const HOME_H    = 34;
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

export function DeviceFrameMobile({ children, bg }: Props) {
  const { containerRef, scale } = useDeviceScale(FRAME_W, FRAME_H);
  const sc = statusColor(bg);

  return (
    // Fill the parent — this is the element we measure
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {/* Wrapper that occupies only the scaled size so centering works */}
      <div style={{ width: FRAME_W * scale, height: FRAME_H * scale, position: "relative", flexShrink: 0 }}>
        {/* Frame at natural size, scaled via transform */}
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
              borderRadius: 50,
              background: "linear-gradient(150deg, #2c2c2e 0%, #1c1c1e 100%)",
              position: "relative",
              boxShadow:
                "0 0 0 1.5px #48484a," +
                "inset 0 0 0 1px rgba(255,255,255,0.07)," +
                "0 40px 100px rgba(0,0,0,0.75)," +
                "0 8px 30px rgba(0,0,0,0.4)",
            }}
          >

            {/* ── Physical buttons (decorative) ── */}
            {/* Mute */}
            <div style={{ position: "absolute", left: -4, top: 110, width: 4, height: 24, background: "#48484a", borderRadius: "3px 0 0 3px" }} />
            {/* Volume + */}
            <div style={{ position: "absolute", left: -4, top: 164, width: 4, height: 34, background: "#48484a", borderRadius: "3px 0 0 3px" }} />
            {/* Volume - */}
            <div style={{ position: "absolute", left: -4, top: 210, width: 4, height: 34, background: "#48484a", borderRadius: "3px 0 0 3px" }} />
            {/* Power */}
            <div style={{ position: "absolute", right: -4, top: 176, width: 4, height: 68, background: "#48484a", borderRadius: "0 3px 3px 0" }} />

            {/* ── Screen area ── */}
            <div
              style={{
                position: "absolute",
                top: INSET, left: INSET,
                width: SCREEN_W, height: SCREEN_H,
                borderRadius: 40,
                background: bg,
                overflow: "hidden",
                // thin inner shadow to separate screen from bezel
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
              }}
            >

              {/* ── Status bar ── */}
              <div style={{ height: STATUS_H, position: "relative", background: bg, flexShrink: 0 }}>

                {/* Dynamic Island */}
                <div
                  style={{
                    position: "absolute",
                    top: 16, left: "50%", transform: "translateX(-50%)",
                    width: 126, height: 36,
                    background: "#000",
                    borderRadius: 20,
                    zIndex: 1,
                  }}
                />

                {/* Time */}
                <span
                  style={{
                    position: "absolute", left: 26, top: 17,
                    fontSize: 15, fontWeight: 700,
                    color: sc,
                    fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                    letterSpacing: "0.01em",
                  }}
                >
                  9:41
                </span>

                {/* Status icons (right side) */}
                <div
                  style={{
                    position: "absolute", right: 24, top: 20,
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {/* Signal bars */}
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 1.5 }}>
                    {[5, 8, 11, 14].map((h, i) => (
                      <div
                        key={i}
                        style={{
                          width: 3, height: h,
                          background: i < 3 ? sc : `${sc.replace("0.85", "0.25").replace("0.9", "0.25")}`,
                          borderRadius: 1.5,
                        }}
                      />
                    ))}
                  </div>
                  {/* Battery */}
                  <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <div
                      style={{
                        width: 24, height: 12,
                        border: `1.5px solid ${sc}`,
                        borderRadius: 3.5,
                        padding: 2,
                        display: "flex", alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1, height: "100%", background: sc, borderRadius: 1.5 }} />
                    </div>
                    <div style={{ width: 2, height: 5, background: sc, borderRadius: "0 1.5px 1.5px 0", marginLeft: 1 }} />
                  </div>
                </div>
              </div>

              {/* ── Form content ── */}
              <div style={{ height: CONTENT_H, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {children}
              </div>

              {/* ── Home indicator ── */}
              <div
                style={{
                  height: HOME_H,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: bg,
                }}
              >
                <div
                  style={{
                    width: 134, height: 5,
                    background: sc,
                    borderRadius: 3,
                    opacity: 0.2,
                  }}
                />
              </div>

            </div>{/* /screen */}
          </div>{/* /body */}
        </div>{/* /frame natural size */}
      </div>{/* /size wrapper */}
    </div>
  );
}
