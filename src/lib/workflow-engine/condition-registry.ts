import type { ConditionResolver } from "./types";

const resolvers = new Map<string, ConditionResolver>();

export function registerConditionResolver(resolver: ConditionResolver): void {
  if (resolvers.has(resolver.type)) {
    throw new Error(`Condition type já registrado: ${resolver.type}`);
  }
  resolvers.set(resolver.type, resolver);
}

export function getConditionResolver(type: string): ConditionResolver | undefined {
  return resolvers.get(type);
}

export function listConditionResolvers(): ConditionResolver[] {
  return Array.from(resolvers.values());
}
