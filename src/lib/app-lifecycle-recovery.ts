/**
 * A recuperação visual pode remontar páginas sem estado pendente. Modais
 * abertos preservam rascunhos locais e, por isso, bloqueiam essa remontagem.
 */
export function canRemountAppForRecovery(modalCount: number, statePreservationCount = 0): boolean {
  return modalCount === 0 && statePreservationCount === 0;
}
