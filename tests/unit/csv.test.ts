import { describe, it, expect } from "vitest";
import { generateLeadsCsv, LeadForCsv } from "@/lib/csv";

describe("CSV Generator", () => {
  it("includes UTF-8 BOM prefix and semicolon separators for French Excel", () => {
    const leads: LeadForCsv[] = [
      {
        name: 'Boulangerie "La Grace"',
        category: "Boulangerie",
        phone: "+237699123456",
        city: "Douala",
        rating: 4.5,
      },
    ];

    const csv = generateLeadsCsv(leads);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('";"');
    expect(csv).toContain('""La Grace""');
    expect(csv).toContain("'+237699123456");
  });
});
