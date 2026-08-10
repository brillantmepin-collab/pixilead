/**
 * Adaptateur Moneroo — https://docs.moneroo.io/
 *
 * Adapté du skill `izisaas-payments-handler` pour un usage MONO-MARCHAND :
 * PixiLead est le marchand, les clés vivent en variables d'environnement.
 * Le coffre-fort AES-256-GCM `payment_connections` du skill (destiné aux
 * marketplaces BYOK) n'a pas lieu d'être ici.
 *
 * Pièges pris en compte (documentés dans references/moneroo.md) :
 *   • `customer.first_name` / `last_name` sont OBLIGATOIRES → 400 silencieux sinon
 *   • les valeurs de `metadata` doivent être des chaînes → 422 sinon
 *   • `description` > 200 caractères → 422
 *   • pas de `cancel_url` : `return_url` est la seule URL de redirection
 *   • un 200 OK sans `data.id` ET `data.checkout_url` est un échec
 */

const MONEROO_API_URL = "https://api.moneroo.io";
const FETCH_TIMEOUT_MS = 15_000;

export function getMonerooSecretKey(): string | null {
  const key = process.env.MONEROO_SECRET_KEY;
  if (!key || key.includes("placeholder")) return null;
  return key;
}

export function getMonerooWebhookSecret(): string | null {
  const secret = process.env.MONEROO_WEBHOOK_SECRET;
  if (!secret || secret.includes("placeholder")) return null;
  return secret;
}

/** Moneroo est-il réellement configuré ? Sinon l'app bascule en mode démo. */
export function isMonerooConfigured(): boolean {
  return getMonerooSecretKey() !== null;
}

export type InitiatePaymentParams = {
  /** Dans la plus petite unité de la devise (XAF/XOF : francs entiers). */
  amount: number;
  currency: string;
  description: string;
  returnUrl: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  metadata?: Record<string, string | number | boolean | undefined | null>;
};

export type InitiatePaymentResult =
  | {
      ok: true;
      providerTransactionId: string;
      checkoutUrl: string;
    }
  | { ok: false; error: string };

/**
 * Moneroo exige un prénom ET un nom. On découpe le nom complet ; s'il n'y a
 * qu'un seul mot, le nom de famille devient "-". Sans nom du tout, on retombe
 * sur la partie locale de l'email.
 */
function splitName(
  full: string | undefined | null,
  fallbackEmail: string
): { first: string; last: string } {
  const value = (full ?? "").trim();
  if (!value) {
    const local = fallbackEmail.split("@")[0] || "Client";
    return { first: local, last: "-" };
  }
  const parts = value.split(/\s+/);
  return { first: parts[0], last: parts.slice(1).join(" ") || "-" };
}

async function monerooFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${MONEROO_API_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function initiatePayment(
  params: InitiatePaymentParams,
  secretKey: string
): Promise<InitiatePaymentResult> {
  const { first, last } = splitName(params.customerName, params.customerEmail);

  const body = {
    amount: params.amount,
    currency: params.currency,
    description: params.description.slice(0, 200),
    return_url: params.returnUrl,
    customer: {
      email: params.customerEmail,
      first_name: first,
      last_name: last,
      ...(params.customerPhone ? { phone: params.customerPhone } : {}),
    },
    // Moneroo refuse les valeurs non-textuelles dans metadata (422).
    metadata: Object.fromEntries(
      Object.entries(params.metadata ?? {})
        .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
        .map(([k, v]) => [k, String(v)])
    ),
  };

  let res: Response;
  try {
    res = await monerooFetch("/v1/payments/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      error: `Impossible de joindre Moneroo : ${(err as Error).message}`,
    };
  }

  let parsed: {
    data?: { id?: string; checkout_url?: string };
    message?: string;
  };
  try {
    parsed = (await res.json()) as typeof parsed;
  } catch {
    return { ok: false, error: `Moneroo a répondu ${res.status} (non-JSON)` };
  }

  // Si la devise XAF/XOF n'est pas encore activée dans le dashboard Moneroo Sandbox,
  // on relance automatiquement l'initialisation en USD de secours.
  if (
    !res.ok &&
    parsed.message?.includes("No payment methods enabled for this currency") &&
    params.currency !== "USD"
  ) {
    console.log(`[MONEROO] Devise ${params.currency} non activée dans le compte marchand sandbox. Bascule automatique vers USD.`);
    
    // Conversion USD cents
    let usdAmount = 900; // Starter ($9)
    if (params.amount >= 35000) usdAmount = 6700; // Business ($67)
    else if (params.amount >= 10000) usdAmount = 2500; // Pro ($25)

    return initiatePayment(
      {
        ...params,
        amount: usdAmount,
        currency: "USD",
      },
      secretKey
    );
  }

  // Un 200/201 OK amputé de l'id ou de l'URL de checkout reste un échec.
  if (!res.ok || !parsed.data?.id || !parsed.data?.checkout_url) {
    return {
      ok: false,
      error: parsed.message || `Moneroo a répondu ${res.status}`,
    };
  }

  return {
    ok: true,
    providerTransactionId: parsed.data.id,
    checkoutUrl: parsed.data.checkout_url,
  };
}

export type VerifiedPayment = {
  status: string;
  amount?: number;
  currency?: string;
};

/**
 * Re-interrogation de l'API Moneroo (défense en profondeur).
 * Si le webhook annonce un succès mais que l'API dit autre chose, on ne
 * crédite pas. Renvoie `null` si l'appel échoue (on ne crédite pas non plus).
 */
export async function verifyPayment(
  providerTransactionId: string,
  secretKey: string
): Promise<VerifiedPayment | null> {
  let res: Response;
  try {
    res = await monerooFetch(
      `/v1/payments/${encodeURIComponent(providerTransactionId)}/verify`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          Accept: "application/json",
        },
      }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const json = (await res.json().catch(() => null)) as {
    data?: {
      status?: string;
      amount?: number | string;
      currency?: { code?: string } | string;
    };
  } | null;
  if (!json?.data?.status) return null;

  // `currency` arrive tantôt en chaîne, tantôt en objet { code }.
  const currency =
    typeof json.data.currency === "string"
      ? json.data.currency
      : json.data.currency?.code;

  return {
    status: String(json.data.status).toLowerCase(),
    amount:
      typeof json.data.amount === "string"
        ? parseInt(json.data.amount, 10)
        : json.data.amount,
    currency,
  };
}

/**
 * Vérifie la validité d'une clé sans déclencher de vrai paiement : on appelle
 * un identifiant volontairement bidon. 401/403 = clé invalide, 404 = clé bonne.
 */
export async function probeKey(
  secretKey: string
): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await monerooFetch(`/v1/payments/pixilead_probe_${Date.now()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau : ${(err as Error).message}` };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: "Clé API Moneroo invalide" };
  }
  return { ok: true };
}
