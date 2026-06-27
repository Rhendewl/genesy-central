import type { EngineErrorCode, EvalResultError, ValidationError } from "./types";

export function engineError(
  code: EngineErrorCode,
  message: string,
  ruleId?: string,
): EvalResultError {
  return { type: "error", code, message, ruleId };
}

export function validationError(
  ruleId: string,
  code: EngineErrorCode,
  message: string,
): ValidationError {
  return { ruleId, code, message };
}
