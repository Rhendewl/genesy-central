import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("public share host", () => {
  it("rewrites the bare go domain to the public landing page", async () => {
    const response = await middleware(new NextRequest("https://go.genesycompany.com/"));
    expect(response.headers.get("x-middleware-rewrite")).toContain("/acesso-publico");
  });

  it("redirects platform routes away from the go domain", async () => {
    const response = await middleware(new NextRequest("https://go.genesycompany.com/clientes?tab=analise"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://go.genesycompany.com/");
  });

  it("keeps supported shared routes available", async () => {
    const response = await middleware(new NextRequest("https://go.genesycompany.com/form/pesquisa-cliente"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps the VGV sale form and its API public", async () => {
    const page = await middleware(new NextRequest("https://go.genesycompany.com/venda/cliente-teste"));
    const api = await middleware(new NextRequest("https://go.genesycompany.com/api/public/vgv/cliente-teste"));
    expect(page.headers.get("x-middleware-next")).toBe("1");
    expect(api.headers.get("x-middleware-next")).toBe("1");
  });
});
