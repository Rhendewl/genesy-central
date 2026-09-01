import { describe, expect, it } from "vitest";
import { computePortalAccountBalance } from "../portal-account-balances";
import { getBalanceAlertTransition } from "../portal-balance-alerts";
import type { PortalAccountBalance } from "@/types";

function balance(overrides: Partial<PortalAccountBalance> = {}): PortalAccountBalance {
  return {
    account_id: "act_1",
    account_name: "Conta Cliente",
    account_status: 1,
    currency: "BRL",
    balance_gross: 200,
    balance_net: 199.99,
    amount_spent: 0,
    funding_type: "Crédito pré-pago",
    funding_display: null,
    is_prepay: true,
    fetched_at: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("getBalanceAlertTransition", () => {
  it("alerta ao entrar abaixo de R$ 200", () => {
    expect(getBalanceAlertTransition(balance(), false)).toBe("alert");
    expect(getBalanceAlertTransition(balance(), null)).toBe("alert");
  });

  it("não repete enquanto o saldo continua baixo", () => {
    expect(getBalanceAlertTransition(balance({ balance_net: 50 }), true)).toBe("unchanged");
  });

  it("rearma depois que uma recarga leva o saldo a R$ 200 ou mais", () => {
    expect(getBalanceAlertTransition(balance({ balance_net: 200 }), true)).toBe("recover");
  });

  it("ignora conta com erro, moeda estrangeira ou pós-paga", () => {
    expect(getBalanceAlertTransition(balance({ account_status: 0 }), false)).toBe("ignore");
    expect(getBalanceAlertTransition(balance({ currency: "USD" }), false)).toBe("ignore");
    expect(getBalanceAlertTransition(balance({ is_prepay: false }), false)).toBe("ignore");
  });
});

describe("computePortalAccountBalance", () => {
  it("usa o saldo líquido informado pela Meta para contas pré-pagas", () => {
    const result = computePortalAccountBalance("19999", "0", "0", 4, "BRL");
    expect(result.balance_net).toBe(199.99);
    expect(result.balance_gross).toBeGreaterThan(199.99);
    expect(result.is_prepay).toBe(true);
  });

  it("mantém uma conta pré-paga identificável mesmo quando chega a zero", () => {
    expect(computePortalAccountBalance("0", "0", "0", "PREPAY", "BRL"))
      .toMatchObject({ balance_net: 0, is_prepay: true });
  });
});
