"use client";

import { motion } from "framer-motion";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
}

export function Header({ title, subtitle, showLogo = false }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex items-center justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-2 gap-3 min-w-0"
    >
      <div className="min-w-0 flex-1">
        {showLogo && (
          <img
            src="/genesy-logo.svg"
            alt="Genesy"
            className="mb-1.5 h-4 sm:h-5 w-auto select-none opacity-75"
            draggable={false}
          />
        )}
        <h1
          className="text-lg sm:text-xl font-bold tracking-tight md:text-2xl truncate"
          style={{ color: "var(--text-title)", letterSpacing: "-0.02em" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-xs sm:text-sm truncate" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>
        )}
      </div>
    </motion.header>
  );
}
