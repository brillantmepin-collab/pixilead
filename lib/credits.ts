/**
 * Catalogue des crédits PixiLead — constantes partagées client / serveur.
 * Ne rien importer ici qui soit réservé au serveur : ce module est bundlé
 * dans les composants clients.
 */

/** Crédits offerts à l'inscription (et aux comptes déjà existants). */
export const SIGNUP_FREE_CREDITS = 5;

/** Coût d'une recherche de leads, quel que soit le nombre de fiches. */
export const SEARCH_CREDIT_COST = 3;

/** Coût d'un message de prospection généré par l'IA. */
export const AI_MESSAGE_CREDIT_COST = 1;

/**
 * Événement navigateur émis après tout mouvement de crédits, pour que la
 * navbar rafraîchisse le solde affiché sans re-fetch complet :
 * `window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: { balance } }))`
 */
export const CREDITS_EVENT = "pixilead:credits";

// ─────────────────────────────────────────────────────────────────────────────
// Devises
// ─────────────────────────────────────────────────────────────────────────────

export type Currency = "XAF" | "XOF" | "USD";

/**
 * Devises sans décimales : le montant envoyé à Moneroo est en unités entières
 * (5 000 XAF = `5000`), et non en centimes. Se tromper ici facture 100x trop.
 */
const ZERO_DECIMAL_CURRENCIES: readonly Currency[] = ["XAF", "XOF"];

export function isZeroDecimal(currency: Currency): boolean {
  return ZERO_DECIMAL_CURRENCIES.includes(currency);
}

/**
 * Pays (code ISO 3166-1 alpha-2) → devise de paiement.
 * Les libellés du formulaire de recherche sont mappés dans COUNTRY_LABEL_TO_CODE.
 */
const COUNTRY_CURRENCY: Record<string, Currency> = {
  // CEMAC — XAF
  CM: "XAF", // Cameroun
  GA: "XAF", // Gabon
  TD: "XAF", // Tchad
  CF: "XAF", // Centrafrique
  CG: "XAF", // Congo
  GQ: "XAF", // Guinée équatoriale
  // UEMOA — XOF
  SN: "XOF", // Sénégal
  CI: "XOF", // Côte d'Ivoire
  TG: "XOF", // Togo
  BJ: "XOF", // Bénin
  BF: "XOF", // Burkina Faso
  ML: "XOF", // Mali
  NE: "XOF", // Niger
  GW: "XOF", // Guinée-Bissau
  // Hors zone franc — facturation en USD
  CD: "USD", // RDC
};

/** Libellés du sélecteur de pays de l'app → code ISO. */
export const COUNTRY_LABEL_TO_CODE: Record<string, string> = {
  Cameroun: "CM",
  "Côte d'Ivoire": "CI",
  Sénégal: "SN",
  Gabon: "GA",
  RDC: "CD",
  Togo: "TG",
  Bénin: "BJ",
};

export const COUNTRY_OPTIONS: { code: string; label: string; flag: string }[] = [
  { code: "CM", label: "Cameroun", flag: "🇨🇲" },
  { code: "CI", label: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "SN", label: "Sénégal", flag: "🇸🇳" },
  { code: "GA", label: "Gabon", flag: "🇬🇦" },
  { code: "CD", label: "RDC", flag: "🇨🇩" },
  { code: "TG", label: "Togo", flag: "🇹🇬" },
  { code: "BJ", label: "Bénin", flag: "🇧🇯" },
];

/** Devise de facturation pour un pays. Repli sur XAF (pays par défaut : Cameroun). */
export function currencyForCountry(country?: string | null): Currency {
  if (!country) return "XAF";
  const code = COUNTRY_LABEL_TO_CODE[country] || country.trim().toUpperCase();
  return COUNTRY_CURRENCY[code] ?? "XAF";
}

// ─────────────────────────────────────────────────────────────────────────────
// Packs de crédits
// ─────────────────────────────────────────────────────────────────────────────

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  /** Montant dans la plus petite unité de chaque devise. */
  prices: Record<Currency, number>;
  tagline: string;
  popular?: boolean;
};

/**
 * XAF et XOF sont à parité, donc mêmes montants. L'USD est converti à
 * ~600 XAF/USD et exprimé en cents (devise à décimales).
 */
export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 30,
    prices: { XAF: 5000, XOF: 5000, USD: 900 },
    tagline: "10 recherches de leads",
  },
  {
    id: "pro",
    name: "Pro",
    credits: 100,
    prices: { XAF: 15000, XOF: 15000, USD: 2500 },
    tagline: "33 recherches + messages IA",
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    credits: 300,
    prices: { XAF: 40000, XOF: 40000, USD: 6700 },
    tagline: "100 recherches, le meilleur tarif",
  },
];

export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}

/** Montant à facturer pour un pack, dans la plus petite unité de la devise. */
export function packAmount(pack: CreditPack, currency: Currency): number {
  return pack.prices[currency];
}

/** Formatage lisible : `5 000 XAF`, `9.00 USD`. */
export function formatAmount(amount: number, currency: Currency): string {
  const value = isZeroDecimal(currency) ? amount : amount / 100;
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: isZeroDecimal(currency) ? 0 : 2,
    maximumFractionDigits: isZeroDecimal(currency) ? 0 : 2,
  }).format(value);
  return `${formatted} ${currency}`;
}

/** Libellé français d'un motif de mouvement de crédits. */
export function reasonLabel(reason: string): string {
  switch (reason) {
    case "signup_bonus":
      return "Crédits de bienvenue";
    case "purchase":
      return "Achat de crédits";
    case "search":
      return "Recherche de leads";
    case "ai_message":
      return "Message IA généré";
    case "refund_search":
      return "Remboursement (recherche échouée)";
    default:
      return reason;
  }
}
