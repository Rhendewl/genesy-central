import type { IntegrationAdapter, IntegrationMapper } from "./types";

export class IntegrationRegistry {
  private readonly adapters = new Map<string, IntegrationAdapter>();
  private readonly mappers  = new Map<string, IntegrationMapper>();

  register(adapter: IntegrationAdapter, mapper: IntegrationMapper): void {
    if (adapter.name !== mapper.adapterName) {
      throw new Error(
        `Adapter/mapper name mismatch: adapter="${adapter.name}" mapper="${mapper.adapterName}"`,
      );
    }
    this.adapters.set(adapter.name, adapter);
    this.mappers.set(adapter.name, mapper);
  }

  getAdapter(name: string): IntegrationAdapter | undefined { return this.adapters.get(name); }
  getMapper(name:  string): IntegrationMapper  | undefined { return this.mappers.get(name);  }

  has(name: string):  boolean  { return this.adapters.has(name); }
  names():            string[] { return Array.from(this.adapters.keys()); }
}
