"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const items = [['/calculadora', 'Calculadora'], ['/calculadora/compartilhamento', 'Compartilhamento'], ['/calculadora/leads', 'Leads capturados']];
export function CalculatorNavigation() {
  const path = usePathname();
  return <nav aria-label="Módulos da calculadora" className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 pt-5 sm:px-6">{items.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className="whitespace-nowrap rounded-full border px-4 py-2 text-sm" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-title)', background: path === href ? 'var(--hover)' : 'transparent' }}>{label}</Link>)}</nav>;
}
