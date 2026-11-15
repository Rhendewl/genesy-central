import { describe, expect, it } from "vitest";
import { leadContactLinks } from "../contact-links";
describe("CRM contact actions", () => {
  it("adds Brazil country code to local numbers including DDD 55", () => {
    expect(leadContactLinks("(85) 99999-1234")).toEqual({ whatsapp: "https://wa.me/5585999991234", telephone: "tel:+5585999991234" });
    expect(leadContactLinks("(55) 99999-1234")?.whatsapp).toBe("https://wa.me/5555999991234");
  });
  it("preserves explicit international numbers without duplicating prefixes", () => {
    expect(leadContactLinks("+55 (85) 99999-1234")?.telephone).toBe("tel:+5585999991234");
    expect(leadContactLinks("+1 (212) 555-1234")?.whatsapp).toBe("https://wa.me/12125551234");
    expect(leadContactLinks("0055 85 99999-1234")?.telephone).toBe("tel:+5585999991234");
  });
  it("does not turn emails, incomplete or malformed contacts into phone links", () => {
    for (const value of ["", "lead123@example.com", "99999-1234", "123", "+12+34567890", "javascript:12345678901"]) expect(leadContactLinks(value)).toBeNull();
  });
});
