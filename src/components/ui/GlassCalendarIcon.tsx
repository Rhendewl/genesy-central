"use client";

import { useId } from "react";

export function GlassCalendarIcon({ color = "#4a8fd4", className = "h-20 w-20" }: { color?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 160 160" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`calendar-${id}`} x1="32" y1="24" x2="132" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity=".72" />
          <stop offset=".28" stopColor={color} stopOpacity=".62" />
          <stop offset="1" stopColor="#111" stopOpacity=".86" />
        </linearGradient>
        <linearGradient id={`calendar-edge-${id}`} x1="28" y1="22" x2="135" y2="140" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity=".92" />
          <stop offset=".5" stopColor={color} stopOpacity=".55" />
          <stop offset="1" stopColor="white" stopOpacity=".18" />
        </linearGradient>
        <filter id={`calendar-shadow-${id}`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="#000" floodOpacity=".42" />
          <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor={color} floodOpacity=".28" />
        </filter>
      </defs>
      <ellipse cx="80" cy="140" rx="48" ry="8" fill="#000" opacity=".2" />
      <g filter={`url(#calendar-shadow-${id})`}>
        <rect x="27" y="31" width="106" height="102" rx="22" fill={`url(#calendar-${id})`} stroke={`url(#calendar-edge-${id})`} strokeWidth="2" />
        <path d="M28 64h104" stroke="white" strokeOpacity=".46" strokeWidth="2" />
        <rect x="47" y="20" width="10" height="29" rx="5" fill="#e9eef3" fillOpacity=".92" />
        <rect x="103" y="20" width="10" height="29" rx="5" fill="#e9eef3" fillOpacity=".92" />
        {[0, 1, 2].map((row) => [0, 1, 2].map((column) => (
          <rect key={`${row}-${column}`} x={47 + column * 25} y={78 + row * 19} width="11" height="8" rx="3" fill="white" fillOpacity={row === 1 && column === 1 ? ".92" : ".46"} />
        )))}
      </g>
    </svg>
  );
}
