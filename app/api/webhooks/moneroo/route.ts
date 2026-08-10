import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  verifySignature,
  computeEventId,
  parseEvent,
} from "@/lib/moneroo/webhook";
import {
  verifyPayment,
  getMonerooSecretKey,
  getMonerooWebhookSecret,
} from "@/lib/moneroo/client";
import { grantCreditsForPayment } from "@/lib/credits-server";

// `nodejs` est obligatoire : la vérification de signature utilise node:crypto.
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Réception des webhooks Moneroo.
 *
 * URL à coller dans le dashboard Moneroo → Developers → Webhooks :
 *   https://<votre-domaine>/api/webhooks/moneroo
 *
 * Pipeline (ordre volontaire, chaque étape est un garde-fou) :
 *   1. lecture du CORPS BRUT (jamais request.json() : le HMAC porte sur les octets)
 *   2. vérification de la signature HMAC-SHA256 en temps constant
 *   3. déduplication de l'événement (Moneroo rejoue jusqu'à 5 fois)
 *   4. résolution de la ligne payments
 *   5. contrôle anti-falsification du montant
 *   6. re-interrogation de l'API Moneroo (défense en profondeur)
 *   7. crédit atomique et idempotent
 */
export async function POST(request: NextRequest) {
  // 1. Corps brut — request.json() détruirait la correspondance du HMAC.
  const rawBody = await request.text();

  const webhookSecret = getMonerooWebhookSecret();
  if (!webhookSecret) {
    console.error("[MONEROO WEBHOOK] MONEROO_WEBHOOK_SECRET non configurée");
    return NextResponse.json(
      { error: "Webhook non configuré" },
      { status: 503 }
    );
  }

  // 2. Signature.
  const signature = request.headers.get("x-moneroo-signature");
  const verified = verifySignature(rawBody, signature, webhookSecret);
  if (!verified.ok) {
    console.warn("[MONEROO WEBHOOK] Signature rejetée:", verified.error);
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 3. Déduplication. Moneroo n'a pas d'id d'événement stable : on hashe le corps.
  const eventId = computeEventId(rawBody);
  const { error: dedupError } = await supabase
    .from("processed_events")
    .insert({ provider: "moneroo", event_id: eventId });

  if (dedupError) {
    // Violation de clé primaire = événement déjà traité. C'est le cas nominal
    // lors d'un rejeu, pas une erreur.
    if (dedupError.code === "23505") {
      return NextResponse.json({ received: true, deduped: true });
    }
    console.error("[MONEROO WEBHOOK] Erreur de déduplication:", dedupError);
  }

  const event = parseEvent(body);
  if (!event) {
    // payment.initiated ou payload non reconnu → accusé de réception, sans action.
    return NextResponse.json({ received: true, ignored: true });
  }

  // 4. Résolution du paiement : par metadata.paymentId, sinon par l'id Moneroo.
  let payment: Record<string, any> | null = null;

  if (event.paymentId) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("id", event.paymentId)
      .single();
    payment = data;
  }
  if (!payment) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_transaction_id", event.providerTransactionId)
      .single();
    payment = data;
  }

  if (!payment) {
    console.error(
      `[MONEROO WEBHOOK] Aucun paiement pour la transaction ${event.providerTransactionId}`
    );
    // 200 volontaire : rien à réconcilier, inutile que Moneroo rejoue.
    return NextResponse.json({ received: true, unknownPayment: true });
  }

  await supabase
    .from("payments")
    .update({
      webhook_received_at: new Date().toISOString(),
      provider_transaction_id:
        payment.provider_transaction_id || event.providerTransactionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  // Échec / annulation : on ferme la ligne, aucun crédit.
  if (event.status === "failed") {
    await supabase
      .from("payments")
      .update({
        status: "failed",
        failure_reason: event.failureReason || "Paiement échoué",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("status", "pending");

    console.log(`[MONEROO WEBHOOK] Paiement ${payment.id} échoué`);
    return NextResponse.json({ received: true, status: "failed" });
  }

  // 5. Anti-falsification du montant. Moneroo règle en totalité : tout écart
  //    est refusé, on ne crédite pas.
  if (
    (event.reportedAmount !== undefined &&
      event.reportedAmount !== payment.amount_total) ||
    (event.reportedCurrency !== undefined &&
      event.reportedCurrency !== payment.currency)
  ) {
    console.error(
      `[MONEROO WEBHOOK] Écart de montant sur ${payment.id} : attendu ${payment.amount_total} ${payment.currency}, annoncé ${event.reportedAmount} ${event.reportedCurrency}`
    );
    await supabase
      .from("payments")
      .update({
        status: "failed",
        failure_reason: "Écart de montant détecté sur le webhook",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("status", "pending");
    return NextResponse.json(
      { error: "Écart de montant" },
      { status: 400 }
    );
  }

  // 6. Re-interrogation : si le webhook secret fuitait, un attaquant pourrait
  //    forger une signature valide. La clé API, elle, ne quitte jamais le serveur.
  const secretKey = getMonerooSecretKey();
  if (secretKey) {
    const live = await verifyPayment(event.providerTransactionId, secretKey);
    if (live && live.status !== "success") {
      console.error(
        `[MONEROO WEBHOOK] Divergence à la re-vérification de ${payment.id} : live=${live.status}`
      );
      await supabase
        .from("payments")
        .update({
          status: "failed",
          failure_reason: `Divergence à la re-vérification : live=${live.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .eq("status", "pending");
      return NextResponse.json({ received: true, status: "failed" });
    }
  }

  // 7. Crédit atomique. La RPC garde `WHERE status = 'pending'` : un rejeu ne
  //    crédite pas une seconde fois.
  const granted = await grantCreditsForPayment(supabase, payment.id);

  if (granted.granted) {
    console.log(
      `[✅ MONEROO WEBHOOK] ${granted.credits} crédits accordés à ${payment.user_id} — nouveau solde ${granted.balance}`
    );
  } else {
    console.log(
      `[MONEROO WEBHOOK] Paiement ${payment.id} non crédité (${granted.reason})`
    );
  }

  return NextResponse.json({ received: true, ...granted });
}

/** Petit ping de diagnostic — Moneroo n'appelle que POST. */
export async function GET() {
  return NextResponse.json({
    endpoint: "moneroo-webhook",
    configured: Boolean(getMonerooWebhookSecret()),
  });
}
