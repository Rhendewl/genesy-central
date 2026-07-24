"use client";

import { motion } from "framer-motion";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, showLogo = false, actions }: HeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex min-w-0 flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-4 sm:flex-nowrap sm:px-6 sm:pt-6"
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
          <p className="mt-0.5 line-clamp-2 text-xs sm:line-clamp-1 sm:text-sm" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center justify-end gap-2.5 max-[420px]:w-full">{actions}</div>}
    </motion.header>
  );
}
