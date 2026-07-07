import type { ActionExecutor } from "./types";

const executors = new Map<string, ActionExecutor>();

export function registerActionExecutor(executor: ActionExecutor): void {
  if (executors.has(executor.type)) {
    throw new Error(`Action type já registrado: ${executor.type}`);
  }
  executors.set(executor.type, executor);
}

export function getActionExecutor(type: string): ActionExecutor | undefined {
  return executors.get(type);
}

export function listActionExecutors(): ActionExecutor[] {
  return Array.from(executors.values());
}
