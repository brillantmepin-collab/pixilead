import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  verifySignature,
  computeEventId,
  parseEvent,
} from "@/lib/moneroo/webhook";

const SECRET = "whsec_test_moneroo_pixilead";

function sign(rawBody: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

describe("Vérification de signature Moneroo", () => {
  const rawBody = JSON.stringify({
    event: "payment.success",
    data: { id: "py_01H", amount: 5000, currency: "XAF" },
  });

  it("accepte une signature valide", () => {
    expect(verifySignature(rawBody, sign(rawBody), SECRET)).toEqual({ ok: true });
  });

  it("refuse une signature calculée avec un autre secret", () => {
    const result = verifySignature(rawBody, sign(rawBody, "mauvais-secret"), SECRET);
    expect(result.ok).toBe(false);
  });

  it("refuse l'absence d'en-tête de signature", () => {
    const result = verifySignature(rawBody, null, SECRET);
    expect(result).toEqual({
      ok: false,
      error: "En-tête x-moneroo-signature absent",
    });
  });

  it("refuse une signature de longueur différente sans lever d'exception", () => {
    // crypto.timingSafeEqual lève si les longueurs diffèrent : le garde-fou
    // de longueur doit intervenir avant.
    expect(() => verifySignature(rawBody, "abc", SECRET)).not.toThrow();
    expect(verifySignature(rawBody, "abc", SECRET).ok).toBe(false);
  });

  it("refuse si le corps a été modifié d'un seul octet", () => {
    const signature = sign(rawBody);
    const tampered = rawBody.replace("5000", "5001");
    expect(verifySignature(tampered, signature, SECRET).ok).toBe(false);
  });

  it("dépend des octets bruts, pas du JSON re-sérialisé", () => {
    // Même objet, sérialisation différente (espaces) => signature invalide.
    const signature = sign(rawBody);
    const reStringified = JSON.stringify(JSON.parse(rawBody), null, 2);
    expect(verifySignature(reStringified, signature, SECRET).ok).toBe(false);
  });
});

describe("Identifiant d'événement synthétique", () => {
  it("est stable pour un corps identique", () => {
    const body = '{"event":"payment.success"}';
    expect(computeEventId(body)).toBe(computeEventId(body));
  });

  it("diffère dès que le corps change", () => {
    expect(computeEventId('{"a":1}')).not.toBe(computeEventId('{"a":2}'));
  });

  it("est préfixé et de longueur fixe", () => {
    const id = computeEventId("{}");
    expect(id.startsWith("synthetic-")).toBe(true);
    expect(id).toHaveLength("synthetic-".length + 32);
  });
});

describe("Normalisation des événements Moneroo", () => {
  it("mappe payment.success sur completed et remonte metadata.paymentId", () => {
    const event = parseEvent({
      event: "payment.success",
      data: {
        id: "py_01H",
        amount: 15000,
        currency: "XAF",
        metadata: { paymentId: "1f0c8a2e-0000-4000-8000-000000000000" },
      },
    });
    expect(event).toEqual({
      providerTransactionId: "py_01H",
      status: "completed",
      reportedAmount: 15000,
      reportedCurrency: "XAF",
      paymentId: "1f0c8a2e-0000-4000-8000-000000000000",
    });
  });

  it("mappe payment.failed et payment.cancelled sur failed", () => {
    expect(parseEvent({ event: "payment.failed", data: { id: "py_1" } })?.status).toBe(
      "failed"
    );
    expect(
      parseEvent({ event: "payment.cancelled", data: { id: "py_2" } })?.status
    ).toBe("failed");
  });

  it("ignore payment.initiated (la ligne est déjà en pending)", () => {
    expect(parseEvent({ event: "payment.initiated", data: { id: "py_1" } })).toBeNull();
  });

  it("accepte currency en objet comme en chaîne", () => {
    const asObject = parseEvent({
      event: "payment.success",
      data: { id: "py_1", currency: { code: "XOF" } },
    });
    expect(asObject?.reportedCurrency).toBe("XOF");
  });

  it("convertit un montant transmis en chaîne", () => {
    const event = parseEvent({
      event: "payment.success",
      data: { id: "py_1", amount: "5000" },
    });
    expect(event?.reportedAmount).toBe(5000);
  });

  it("rejette les payloads inexploitables", () => {
    expect(parseEvent(null)).toBeNull();
    expect(parseEvent({})).toBeNull();
    expect(parseEvent({ event: "payment.success" })).toBeNull();
    // Sans data.id, impossible de rattacher le paiement.
    expect(parseEvent({ event: "payment.success", data: {} })).toBeNull();
  });
});
