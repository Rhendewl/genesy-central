import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Lancaster design tokens
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        // Lancaster brand colors (new premium palette)
        lancaster: {
          "bg-base": "#000000",
          "bg-card-from": "#000000",
          "bg-card-mid": "#0f174a",
          "bg-card-to": "#000000",
          "border-from": "#171717",
          "border-to": "#4c4c4c",
          "text-title": "#ffffff",
          "text-body": "#9ca3af",
          hover: "#0d1226",
          "btn-from": "#0b0c20",
          "btn-mid": "#093079",
          "btn-to": "#66aed6",
          "btn-border": "#133d83",
        },
        // Chart series colors
        "chart-receitas": "#27f2e6",
        "chart-mrr": "#27a3ff",
        "chart-despesas": "#fe7b4a",
        // Module accent colors
        success: "#22c55e",
        warning: "#f59e0b",
        revenue: "#27f2e6",
        noshow: "#f59e0b",
        // Kanban column colors
        kanban: {
          abordados: "#27a3ff",
          andamento: "#1e8fdf",
          formulario: "#1670b0",
          reuniao: "#0d5490",
          realizada: "#22c55e",
          noshow: "#f59e0b",
          venda: "#27f2e6",
        },
      },
      backgroundImage: {
        "card-dark":
          "linear-gradient(180deg, #000000 0%, #0f174a 50%, #000000 100%)",
        "btn-primary":
          "linear-gradient(90deg, #0b0c20 0%, #093079 55%, #66aed6 100%)",
        "funnel-blue":
          "linear-gradient(to right, rgba(11,12,32,0.9), rgba(9,48,121,0.65))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "20px",
        "3xl": "28px",
        "4xl": "32px",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        kpi: ["2.25rem", { lineHeight: "1.1", fontWeight: "700" }],
      },
      boxShadow: {
        card: "0 8px 40px rgba(0,0,0,0.55)",
        "card-hover":
          "0 16px 60px rgba(0,0,0,0.65), 0 0 32px rgba(9,48,121,0.18)",
        dock: "0 -4px 48px rgba(0,0,0,0.6)",
        glass: "0 8px 32px rgba(0,0,0,0.4)",
        "btn-blue":
          "0 4px 24px rgba(9,48,121,0.50), 0 0 16px rgba(102,174,214,0.22)",
        "glow-blue": "0 0 24px rgba(39,163,255,0.4)",
      },
      backdropBlur: {
        glass: "18px",
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease-out",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "count-up": "countUp 0.8s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        countUp: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 12px rgba(39,163,255,0.3)" },
          "50%": { boxShadow: "0 0 24px rgba(39,163,255,0.6)" },
        },
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
