/**
 * Supabase mantém um lock interno enquanto executa onAuthStateChange.
 * Qualquer chamada assíncrona ao mesmo cliente deve começar no macrotask
 * seguinte, depois que o callback de autenticação já retornou.
 */
export function deferAuthStateWork(work: () => void): number {
  return window.setTimeout(work, 0);
}
