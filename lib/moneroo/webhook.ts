import crypto from "node:crypto";

/**
 * Vérification de signature et normalisation des webhooks Moneroo.
 *
 * En-tête : `X-Moneroo-Signature`
 * Algorithme : HMAC-SHA256 hex du CORPS BRUT avec le webhook secret.
 *
 * Le HMAC doit être calculé sur les octets bruts de la requête, JAMAIS sur un
 * `JSON.stringify(body)` re-sérialisé : le parsing JSON modifie les espaces et
 * l'ordre des champs, la signature ne correspondrait jamais.
 */

export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): { ok: true } | { ok: false; error: string } {
  if (!signatureHeader) {
    return { ok: false, error: "En-tête x-moneroo-signature absent" };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const received = Buffer.from(signatureHeader.trim());
  const computed = Buffer.from(expected);

  // timingSafeEqual lève une exception si les longueurs diffèrent :
  // on compare d'abord, puis en temps constant.
  if (received.length !== computed.length) {
    return { ok: false, error: "Longueur de signature Moneroo invalide" };
  }
  if (!crypto.timingSafeEqual(received, computed)) {
    return { ok: false, error: "Signature Moneroo invalide" };
  }
  return { ok: true };
}

/**
 * Moneroo ne fournit pas d'identifiant d'événement stable : on en dérive un
 * du hash du corps brut pour la déduplication.
 */
export function computeEventId(rawBody: string): string {
  return `synthetic-${crypto
    .createHash("sha256")
    .update(rawBody, "utf8")
    .digest("hex")
    .slice(0, 32)}`;
}

export type NormalizedEvent = {
  providerTransactionId: string;
  status: "completed" | "failed";
  failureReason?: string;
  reportedAmount?: number;
  reportedCurrency?: string;
  /** `metadata.paymentId` renvoyé tel quel par Moneroo. */
  paymentId?: string;
};

/**
 * Normalise le payload. Renvoie `null` pour `payment.initiated`, qui est
 * purement informatif : la ligne est déjà en `pending` depuis le checkout.
 */
export function parseEvent(body: unknown): NormalizedEvent | null {
  const b = body as { event?: string; data?: Record<string, unknown> } | null;
  if (!b?.event || !b.data) return null;

  const data = b.data;
  const id = typeof data.id === "string" ? data.id : undefined;
  if (!id) return null;

  const reportedAmount =
    typeof data.amount === "number"
      ? data.amount
      : typeof data.amount === "string"
        ? parseInt(data.amount, 10)
        : undefined;

  const reportedCurrency =
    typeof data.currency === "string"
      ? data.currency
      : (data.currency as { code?: string } | undefined)?.code;

  const metadata = (data.metadata || {}) as Record<string, unknown>;
  const paymentId =
    typeof metadata.paymentId === "string" ? metadata.paymentId : undefined;

  if (b.event === "payment.success") {
    return {
      providerTransactionId: id,
      status: "completed",
      reportedAmount,
      reportedCurrency,
      paymentId,
    };
  }

  if (b.event === "payment.failed" || b.event === "payment.cancelled") {
    return {
      providerTransactionId: id,
      status: "failed",
      failureReason: typeof data.status === "string" ? data.status : b.event,
      reportedAmount,
      reportedCurrency,
      paymentId,
    };
  }

  return null; // payment.initiated → ignoré
}
