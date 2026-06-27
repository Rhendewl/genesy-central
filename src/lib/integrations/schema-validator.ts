import type { TransformedEvent, IntegrationConfig } from "./types";

export interface SchemaValidator {
  validate(event: TransformedEvent, config: IntegrationConfig): boolean | Promise<boolean>;
}

export class NoopSchemaValidator implements SchemaValidator {
  validate(_event: TransformedEvent, _config: IntegrationConfig): boolean {
    return true;
  }
}
