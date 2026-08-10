import { describe, it, expect } from "vitest";
import {
  currencyForCountry,
  formatAmount,
  isZeroDecimal,
  getCreditPack,
  packAmount,
  CREDIT_PACKS,
  SEARCH_CREDIT_COST,
  AI_MESSAGE_CREDIT_COST,
  SIGNUP_FREE_CREDITS,
} from "@/lib/credits";

describe("Barème de crédits", () => {
  it("offre 5 crédits, soit exactement une recherche + 2 messages IA", () => {
    expect(SIGNUP_FREE_CREDITS).toBe(5);
    expect(SEARCH_CREDIT_COST).toBe(3);
    expect(AI_MESSAGE_CREDIT_COST).toBe(1);
    expect(
      SIGNUP_FREE_CREDITS - SEARCH_CREDIT_COST - 2 * AI_MESSAGE_CREDIT_COST
    ).toBe(0);
  });
});

describe("Devise selon le pays du profil", () => {
  it("mappe la zone CEMAC sur XAF", () => {
    expect(currencyForCountry("CM")).toBe("XAF");
    expect(currencyForCountry("GA")).toBe("XAF");
  });

  it("mappe la zone UEMOA sur XOF", () => {
    expect(currencyForCountry("SN")).toBe("XOF");
    expect(currencyForCountry("CI")).toBe("XOF");
    expect(currencyForCountry("TG")).toBe("XOF");
    expect(currencyForCountry("BJ")).toBe("XOF");
  });

  it("facture la RDC en USD (hors zone franc)", () => {
    expect(currencyForCountry("CD")).toBe("USD");
  });

  it("accepte aussi les libellés du sélecteur de pays", () => {
    expect(currencyForCountry("Cameroun")).toBe("XAF");
    expect(currencyForCountry("Côte d'Ivoire")).toBe("XOF");
    expect(currencyForCountry("RDC")).toBe("USD");
  });

  it("retombe sur XAF pour une valeur absente ou inconnue", () => {
    expect(currencyForCountry(null)).toBe("XAF");
    expect(currencyForCountry("")).toBe("XAF");
    expect(currencyForCountry("ZZ")).toBe("XAF");
  });
});

describe("Devises sans décimales", () => {
  // Se tromper ici facture 100x trop : XAF/XOF s'envoient en francs entiers.
  it("classe correctement XAF, XOF et USD", () => {
    expect(isZeroDecimal("XAF")).toBe(true);
    expect(isZeroDecimal("XOF")).toBe(true);
    expect(isZeroDecimal("USD")).toBe(false);
  });

  it("formate sans décimale en franc CFA et avec deux décimales en USD", () => {
    expect(formatAmount(5000, "XAF").replace(/ | /g, " ")).toBe(
      "5 000 XAF"
    );
    expect(formatAmount(900, "USD")).toBe("9,00 USD");
  });
});

describe("Packs de crédits", () => {
  it("expose un prix pour chaque devise supportée", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.prices.XAF).toBeGreaterThan(0);
      expect(pack.prices.XOF).toBeGreaterThan(0);
      expect(pack.prices.USD).toBeGreaterThan(0);
      // Les montants partent chez Moneroo tels quels : ils doivent être entiers.
      expect(Number.isInteger(pack.prices.XAF)).toBe(true);
      expect(Number.isInteger(pack.prices.USD)).toBe(true);
    }
  });

  it("applique la parité XAF / XOF", () => {
    for (const pack of CREDIT_PACKS) {
      expect(pack.prices.XAF).toBe(pack.prices.XOF);
    }
  });

  it("récupère un pack par son id et son montant dans la bonne devise", () => {
    const pro = getCreditPack("pro");
    expect(pro).toBeDefined();
    expect(packAmount(pro!, "XAF")).toBe(15000);
    expect(packAmount(pro!, "USD")).toBe(2500);
  });

  it("renvoie undefined pour un pack inconnu (le client ne choisit qu'un id)", () => {
    expect(getCreditPack("gratuit-illimite")).toBeUndefined();
  });
});
