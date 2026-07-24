"use client";

import { useId } from "react";

type GlassFolderIconProps = {
  color?: string | null;
  className?: string;
};

export function GlassFolderIcon({ color = "#8fa4bb", className = "h-24 w-28" }: GlassFolderIconProps) {
  const id = useId().replace(/:/g, "");
  const tint = color || "#8fa4bb";

  return (
    <svg
      viewBox="0 0 180 170"
      className={`glass-folder-icon ${className}`}
      style={{ "--folder-icon-color": tint } as React.CSSProperties}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`paper-${id}`} x1="77" y1="25" x2="94" y2="124" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.98" />
          <stop offset="0.48" stopColor="#eeeeee" stopOpacity="0.95" />
          <stop offset="0.78" stopColor="#bdbdbd" stopOpacity="0.78" />
          <stop offset="1" stopColor="#727272" stopOpacity="0.42" />
        </linearGradient>
        <linearGradient id={`front-${id}`} x1="35" y1="65" x2="150" y2="151" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f4f4f4" stopOpacity="0.62" />
          <stop offset="0.22" stopColor="#bebebe" stopOpacity="0.62" />
          <stop offset="0.56" stopColor={tint} stopOpacity="0.42" />
          <stop offset="0.78" stopColor="#555555" stopOpacity="0.52" />
          <stop offset="1" stopColor="#171717" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id={`edge-${id}`} x1="25" y1="67" x2="157" y2="153" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.92" />
          <stop offset="0.4" stopColor="#d0d0d0" stopOpacity="0.7" />
          <stop offset="0.72" stopColor={tint} stopOpacity="0.48" />
          <stop offset="1" stopColor="#adadad" stopOpacity="0.42" />
        </linearGradient>
        <linearGradient id={`inner-edge-${id}`} x1="33" y1="75" x2="151" y2="146" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.52" />
          <stop offset="0.42" stopColor="white" stopOpacity="0.12" />
          <stop offset="1" stopColor="#090909" stopOpacity="0.6" />
        </linearGradient>
        <radialGradient id={`glint-${id}`} cx="0" cy="0" r="1" gradientTransform="translate(52 83) rotate(27) scale(91 61)" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.38" />
          <stop offset="0.52" stopColor="white" stopOpacity="0.07" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <filter id={`paper-shadow-${id}`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#000000" floodOpacity="0.28" />
        </filter>
        <filter id={`folder-shadow-${id}`} x="-25%" y="-25%" width="150%" height="170%">
          <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#000000" floodOpacity="0.38" />
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={tint} floodOpacity="0.2" />
        </filter>
        <filter id={`soft-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      <ellipse cx="91" cy="151" rx="61" ry="9" fill="#000" opacity="0.24" filter={`url(#soft-${id})`} />

      <g filter={`url(#paper-shadow-${id})`}>
        <path
          d="M65 58 91 32h41c5 0 9 4 9 9v82c0 5-4 9-9 9H74c-5 0-9-4-9-9V58Z"
          fill={`url(#paper-${id})`}
          stroke="white"
          strokeOpacity="0.42"
          strokeWidth="1.2"
        />
      </g>

      <g filter={`url(#folder-shadow-${id})`}>
        <path
          d="M25 82c0-8.8 7.2-16 16-16h38.5c4.8 0 9.4-2.1 12.4-5.8l11.6-13.8c3.1-3.7 7.6-5.8 12.4-5.8H139c9.9 0 18 8.1 18 18v73.2c0 9.9-8.1 18-18 18H43c-9.9 0-18-8.1-18-18V82Z"
          fill={`url(#front-${id})`}
          stroke={`url(#edge-${id})`}
          strokeWidth="2.2"
        />
        <path
          d="M28 83c0-7.7 6.3-14 14-14h38c4.8 0 9.3-2.1 12.4-5.8l11.3-13.4c3.1-3.7 7.6-5.8 12.4-5.8H138c8.8 0 16 7.2 16 16v69.8c0 9.4-7.6 17-17 17H45c-9.4 0-17-7.6-17-17V83Z"
          fill={`url(#glint-${id})`}
          stroke={`url(#inner-edge-${id})`}
          strokeWidth="1.1"
        />
      </g>

      <path d="M37 72c5-2.6 10-3 17-3h27" stroke="white" strokeOpacity="0.48" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M107 49c3-3.5 7-5 12-5h18c9 0 16 7 16 16" stroke="white" strokeOpacity="0.2" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
