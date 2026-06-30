"use client";

import type { ReactNode } from "react";

const CHROME_H = 52; // toolbar height

interface Props {
  children: ReactNode;
  bg:       string;
  slug?:    string;
}

export function DeviceFrameDesktop({ children, bg, slug }: Props) {
  const url = `genesy.app/form/${slug ?? "formulario"}`;

  return (
    <div
      style={{
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        borderRadius: 10,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Browser chrome ── */}
      <div
        style={{
          height: CHROME_H,
          background: "linear-gradient(180deg, #323235 0%, #2a2a2d 100%)",
          borderBottom: "1px solid rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          flexShrink: 0,
          position: "relative",
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <div
            style={{
              width: 13, height: 13, borderRadius: "50%",
              background: "radial-gradient(circle at 40% 35%, #ff7b72, #FF5F57)",
              boxShadow: "0 0 0 0.5px rgba(0,0,0,0.25), inset 0 0.5px 0.5px rgba(255,255,255,0.3)",
            }}
          />
          <div
            style={{
              width: 13, height: 13, borderRadius: "50%",
              background: "radial-gradient(circle at 40% 35%, #ffd662, #FEBC2E)",
              boxShadow: "0 0 0 0.5px rgba(0,0,0,0.25), inset 0 0.5px 0.5px rgba(255,255,255,0.3)",
            }}
          />
          <div
            style={{
              width: 13, height: 13, borderRadius: "50%",
              background: "radial-gradient(circle at 40% 35%, #43e05e, #28C840)",
              boxShadow: "0 0 0 0.5px rgba(0,0,0,0.25), inset 0 0.5px 0.5px rgba(255,255,255,0.3)",
            }}
          />
        </div>

        {/* Address bar — absolutely centered */}
        <div
          style={{
            position: "absolute", left: "50%", transform: "translateX(-50%)",
            width: "52%", minWidth: 200, maxWidth: 460,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "6px 12px",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {/* Lock icon */}
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" style={{ flexShrink: 0 }}>
              <rect x="1.5" y="5" width="7" height="6.5" rx="1.2" stroke="rgba(255,255,255,0.4)" strokeWidth="1.1" />
              <path d="M2.8 5V4a2.2 2.2 0 0 1 4.4 0v1" stroke="rgba(255,255,255,0.4)" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            <span
              style={{
                fontSize: 11.5, color: "rgba(255,255,255,0.5)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
                letterSpacing: "0.01em",
                flex: 1, textAlign: "center",
              }}
            >
              {url}
            </span>
          </div>
        </div>

        {/* Right side — reload icon placeholder */}
        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M12 7A5 5 0 1 1 7 2M7 2L9.5 4.5M7 2L4.5 4.5"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ flex: 1, overflow: "hidden", background: bg, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
