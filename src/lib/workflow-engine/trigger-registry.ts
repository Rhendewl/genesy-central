import type { TriggerResolver } from "./types";

// Registry de tipos de gatilho — mirror de src/lib/conversion-engine/registry.ts.
// Adicionar um tipo novo no futuro = um resolver novo + uma chamada de
// registerTriggerResolver(), zero mudança neste arquivo.

const resolvers = new Map<string, TriggerResolver>();

export function registerTriggerResolver(resolver: TriggerResolver): void {
  if (resolvers.has(resolver.type)) {
    throw new Error(`Trigger type já registrado: ${resolver.type}`);
  }
  resolvers.set(resolver.type, resolver);
}

export function getTriggerResolver(type: string): TriggerResolver | undefined {
  return resolvers.get(type);
}

export function listTriggerResolvers(): TriggerResolver[] {
  return Array.from(resolvers.values());
}

/** União (sem duplicatas) de todo listensTo de todo resolver registrado. */
export function allListenedEvents(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const resolver of listTriggerResolvers()) {
    for (const eventType of resolver.listensTo) {
      if (!seen.has(eventType)) {
        seen.add(eventType);
        out.push(eventType);
      }
    }
  }
  return out;
}
