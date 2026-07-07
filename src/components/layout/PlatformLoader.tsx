"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useGlobalStore } from "@/store";

const CRYSTAL = "M253.02,226.65h243.82c6.92,0,13.55-2.75,18.45-7.64l173.93-173.93c16.64-16.64,4.85-45.08-18.67-45.08H208.5c-6.29,0-12.31,2.5-16.76,6.94L8.24,190.45c-5.27,5.27-8.24,12.43-8.24,19.88v312.98c0,7.87,3.13,15.42,8.69,20.99l182.64,182.64c4.71,4.71,11.09,7.35,17.75,7.35h272.13c14.59,0,26.42-11.83,26.42-26.42v-200.23h139.69c14.59,0,26.42-11.83,26.42-26.42v-113.29c0-14.58-11.82-26.4-26.4-26.4h-113.6c-14.42,0-26.11,11.69-26.11,26.11v140h-254.77c-14.48,0-26.22-11.74-26.22-26.22v-228.4c0-14.56,11.8-26.36,26.36-26.36Z";

// Páginas públicas (visitante externo, sem login) não devem exibir o splash
// da plataforma — são acessadas via link direto e o branding aqui é irrelevante.
const PUBLIC_PATH_PREFIXES = ["/form/", "/agendar/"];

export function PlatformLoader() {
  const pathname = usePathname();
  const theme = useGlobalStore((s) => s.theme);
  const isPublicPage = PUBLIC_PATH_PREFIXES.some((prefix) => pathname?.startsWith(prefix));

  const [visible,  setVisible]  = useState(false);
  const [exiting,  setExiting]  = useState(false);

  useEffect(() => {
    if (isPublicPage) return;
    if (sessionStorage.getItem("genesy-loaded")) return;
    sessionStorage.setItem("genesy-loaded", "1");
    setVisible(true);

    const t1 = setTimeout(() => setExiting(true),  3000);
    const t2 = setTimeout(() => setVisible(false), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isPublicPage]);

  if (!visible || isPublicPage) return null;

  return (
    <>
      <style>{`
        #gl-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        /* Entry */
        .gl-entry {
          opacity: 0;
          will-change: transform, opacity, filter;
          animation: gl-entry 1000ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .gl-entry.gl-exit {
          animation: gl-exit 550ms cubic-bezier(0.4, 0, 1, 1) forwards;
        }

        @keyframes gl-entry {
          0%   { opacity: 0; filter: blur(18px); transform: scale(0.96); }
          60%  { opacity: 1; filter: blur(4px);  transform: scale(0.99); }
          100% { opacity: 1; filter: blur(0px);  transform: scale(1);    }
        }
        @keyframes gl-exit {
          0%   { opacity: 1; filter: brightness(1.5) blur(0px); transform: scale(1.03); }
          28%  { transform: scale(0.98); }
          100% { opacity: 0; filter: brightness(1) blur(12px);  transform: scale(0.98); }
        }

        /* Breathe */
        .gl-breathe {
          will-change: transform;
          animation: gl-breathe 5s ease-in-out 1000ms infinite;
        }
        .gl-exit ~ * .gl-breathe,
        .gl-exit .gl-breathe {
          animation: none;
        }
        @keyframes gl-breathe {
          0%   { transform: scale(1.000); }
          25%  { transform: scale(1.010); }
          50%  { transform: scale(1.000); }
          75%  { transform: scale(0.990); }
          100% { transform: scale(1.000); }
        }

        /* Float */
        .gl-float {
          will-change: transform;
          animation: gl-float 6s ease-in-out 1000ms infinite;
        }
        .gl-exit .gl-float { animation: none; }
        @keyframes gl-float {
          0%   { transform: translateY(0px)  rotate(0deg);    }
          25%  { transform: translateY(-3px) rotate(0.6deg);  }
          50%  { transform: translateY(0px)  rotate(0deg);    }
          75%  { transform: translateY(3px)  rotate(-0.6deg); }
          100% { transform: translateY(0px)  rotate(0deg);    }
        }

        .gl-svg {
          display: block;
          width: 100px;
          height: auto;
          overflow: visible;
        }
      `}</style>

      <div id="gl-overlay" style={{ background: theme === "light" ? "#ffffff" : "#000000" }}>
        <div className={`gl-entry${exiting ? " gl-exit" : ""}`}>
          <div className="gl-breathe">
            <div className="gl-float">

              <svg className="gl-svg"
                viewBox="0 0 697 734.29"
                xmlns="http://www.w3.org/2000/svg">

                <defs>
                  <path id="gl-crystal" d={CRYSTAL} />

                  <linearGradient id="gl-base" x1="0" y1="0" x2="697" y2="734"
                    gradientUnits="userSpaceOnUse">
                    <stop offset="0%"   stopColor="#d8dfe5" />
                    <stop offset="42%"  stopColor="#9da7af" />
                    <stop offset="100%" stopColor="#68737c" />
                  </linearGradient>

                  <linearGradient id="gl-hi" x1="0" y1="0" x2="480" y2="320"
                    gradientUnits="userSpaceOnUse">
                    <stop offset="0%"   stopColor="#fff" stopOpacity={0.75} />
                    <stop offset="28%"  stopColor="#fff" stopOpacity={0.20} />
                    <stop offset="65%"  stopColor="#fff" stopOpacity={0.03} />
                    <stop offset="100%" stopColor="#fff" stopOpacity={0}    />
                  </linearGradient>

                  <linearGradient id="gl-shadow" x1="697" y1="734" x2="260" y2="390"
                    gradientUnits="userSpaceOnUse">
                    <stop offset="0%"   stopColor="#000" stopOpacity={0.22} />
                    <stop offset="55%"  stopColor="#000" stopOpacity={0.04} />
                    <stop offset="100%" stopColor="#000" stopOpacity={0}    />
                  </linearGradient>

                  <linearGradient id="gl-prism" x1="0" y1="734" x2="697" y2="0"
                    gradientUnits="userSpaceOnUse">
                    <stop offset="0%"   stopColor="#aac8f0" stopOpacity={0.10} />
                    <stop offset="40%"  stopColor="#e8f0f8" stopOpacity={0}    />
                    <stop offset="60%"  stopColor="#f8f0e8" stopOpacity={0}    />
                    <stop offset="100%" stopColor="#f0d0b8" stopOpacity={0.09} />
                  </linearGradient>

                  <linearGradient id="gl-sweep-grad" x1="0" y1="0" x2="1" y2="0"
                    gradientUnits="objectBoundingBox">
                    <stop offset="0%"   stopColor="#fff" stopOpacity={0}    />
                    <stop offset="30%"  stopColor="#fff" stopOpacity={0.50} />
                    <stop offset="50%"  stopColor="#fff" stopOpacity={0.82} />
                    <stop offset="70%"  stopColor="#fff" stopOpacity={0.50} />
                    <stop offset="100%" stopColor="#fff" stopOpacity={0}    />
                  </linearGradient>

                  <clipPath id="gl-clip">
                    <use href="#gl-crystal" />
                  </clipPath>

                  <filter id="gl-glow" x="-10%" y="-10%" width="120%" height="120%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
                    <feColorMatrix in="blur" type="matrix"
                      values="1 0 0 0 0.80  0 1 0 0 0.85  0 0 1 0 0.90  0 0 0 0.30 0"
                      result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Crystal glass layers */}
                <g filter="url(#gl-glow)">
                  <use href="#gl-crystal"
                    fill="url(#gl-base)"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={1.5} />
                  <use href="#gl-crystal" fill="url(#gl-hi)"     />
                  <use href="#gl-crystal" fill="url(#gl-shadow)" />
                  <use href="#gl-crystal" fill="url(#gl-prism)"  />
                </g>

                {/* Light sweep — clipped, linear traversal */}
                <g clipPath="url(#gl-clip)">
                  <rect x="-700" y="-60"
                    width="420" height="900"
                    transform="skewX(-13)"
                    fill="url(#gl-sweep-grad)"
                    opacity="0">
                    <animate
                      attributeName="x"
                      from="-700" to="900"
                      dur="2s"
                      begin="1.5s"
                      repeatCount="indefinite"
                      calcMode="linear" />
                    <animate
                      attributeName="opacity"
                      values="0;0;1;1;0;0"
                      keyTimes="0;0.26;0.32;0.74;0.80;1"
                      dur="2s"
                      begin="1.5s"
                      repeatCount="indefinite" />
                  </rect>
                </g>

              </svg>

            </div>
          </div>
        </div>
      </div>
    </>
  );
}
