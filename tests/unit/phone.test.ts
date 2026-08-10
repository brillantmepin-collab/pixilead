import { describe, it, expect } from "vitest";
import { normalizePhone, getWhatsAppLink } from "@/lib/phone";

describe("Phone Utilities", () => {
  it("normalizes Cameroonian local numbers starting with 6 or 0", () => {
    expect(normalizePhone("699123456")).toBe("+237699123456");
    expect(normalizePhone("0699123456")).toBe("+237699123456");
    expect(normalizePhone("6 99 12 34 56")).toBe("+237699123456");
    expect(normalizePhone("+237 6 99-12.34(56)")).toBe("+237699123456");
  });

  it("handles null or invalid phone inputs gracefully", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });

  it("generates correct WhatsApp links", () => {
    expect(getWhatsAppLink("699123456")).toBe("https://wa.me/237699123456");
    expect(getWhatsAppLink("699123456", "Bonjour !")).toBe("https://wa.me/237699123456?text=Bonjour%20!");
  });
});
