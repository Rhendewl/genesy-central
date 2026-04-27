"use client";

import { motion } from "framer-motion";
import { Building2, Users, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Header } from "@/components/layout/Header";

// ─────────────────────────────────────────────────────────────────────────────
// SettingsCard
// ─────────────────────────────────────────────────────────────────────────────

interface SettingsCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  delay?: number;
  accentColor: string;
  glowColor: string;
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  delay = 0,
  accentColor,
  glowColor,
}: SettingsCardProps) {
  const Tag = href ? motion.a : motion.div;

  return (
    <Tag
      {...(href ? { href } : {})}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      whileHover="hover"
      className="group relative flex flex-col gap-5 rounded-2xl p-6 cursor-pointer overflow-hidden"
      style={{
        background: "rgba(0,0,0,0.52)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {/* Glow layer */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        initial={{ opacity: 0 }}
        variants={{
          hover: { opacity: 1 },
        }}
        transition={{ duration: 0.3 }}
        style={{
          background: `radial-gradient(ellipse at 30% 40%, ${glowColor} 0%, transparent 65%)`,
        }}
      />

      {/* Top row: icon + arrow */}
      <div className="relative flex items-start justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: `${accentColor}18` }}
        >
          <Icon size={20} style={{ color: accentColor }} strokeWidth={1.75} />
        </div>

        <motion.div
          className="flex h-7 w-7 items-center justify-center rounded-full opacity-0 group-hover:opacity-100"
          variants={{ hover: { x: 2, y: -2 } }}
          transition={{ duration: 0.2 }}
          style={{ color: accentColor }}
        >
          <ArrowUpRight size={15} />
        </motion.div>
      </div>

      {/* Text */}
      <div className="relative space-y-1.5">
        <motion.h3
          className="text-[15px] font-semibold leading-snug"
          style={{ color: "#ffffff" }}
          variants={{ hover: { color: accentColor } }}
          transition={{ duration: 0.25 }}
        >
          {title}
        </motion.h3>
        <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.42)" }}>
          {description}
        </p>
      </div>

      {/* Bottom accent line */}
      <motion.div
        className="absolute bottom-0 left-6 right-6 h-px"
        initial={{ scaleX: 0, opacity: 0 }}
        variants={{ hover: { scaleX: 1, opacity: 1 } }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60, transparent)` }}
      />
    </Tag>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const CARDS: Omit<SettingsCardProps, "delay">[] = [
  {
    icon: Building2,
    title: "Perfil da Empresa",
    description: "Dados institucionais, identidade e informações da empresa.",
    href: "/configuracoes/perfil",
    accentColor: "#27a3ff",
    glowColor: "rgba(39,163,255,0.08)",
  },
  {
    icon: Users,
    title: "Usuários e Permissões",
    description: "Equipe, acessos, cargos e níveis de permissão.",
    href: "/configuracoes/usuarios",
    accentColor: "#27f2e6",
    glowColor: "rgba(39,242,230,0.07)",
  },
  {
    icon: ShieldCheck,
    title: "Segurança",
    description: "Senha, sessões, proteção e controle de acesso.",
    href: "/configuracoes/seguranca",
    accentColor: "#a78bfa",
    glowColor: "rgba(167,139,250,0.08)",
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 sm:px-6">
      <Header title="Configurações" subtitle="Central de controle da plataforma" />

      <section>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--muted-foreground)" }}
        >
          Módulos
        </motion.p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card, i) => (
            <SettingsCard key={card.title} {...card} delay={0.08 + i * 0.09} />
          ))}
        </div>
      </section>
    </div>
  );
}
