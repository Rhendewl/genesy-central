import { registerTriggerResolver }   from "./trigger-registry";
import { registerConditionResolver } from "./condition-registry";
import { registerActionExecutor }    from "./action-registry";
import { crmTriggerResolvers }       from "./crm/triggers";
import { crmConditionResolvers }     from "./crm/conditions";
import { notificationAction }        from "./actions/notification-action";

let bootstrapped = false;

/**
 * Idempotente — chamar quantas vezes quiser, registra uma única vez.
 * Ponto único de "instalação" de adaptadores de módulo: um módulo futuro
 * (Agenda, Workspace…) só precisa de mais 3 linhas aqui — nenhuma mudança
 * no resto do motor.
 */
export function bootstrapWorkflowEngine(): void {
  if (bootstrapped) return;
  bootstrapped = true;

  crmTriggerResolvers.forEach(registerTriggerResolver);
  crmConditionResolvers.forEach(registerConditionResolver);
  registerActionExecutor(notificationAction);
}
