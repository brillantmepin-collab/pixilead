import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth";
import { grantCreditsForPayment, getBalance } from "@/lib/credits-server";
import { verifyPayment, getMonerooSecretKey } from "@/lib/moneroo/client";

export const runtime = "nodejs";

/**
 * État d'un paiement, interrogé par la page de retour.
 *
 * Si le paiement est encore `pending`, on RE-INTERROGE l'API Moneroo avec la
 * clé secrète — ce n'est pas la même chose que faire confiance aux paramètres
 * d'URL renvoyés par la redirection (ceux-là sont rejouables par l'acheteur et
 * ne prouvent rien). L'appel serveur→Moneroo fait autorité.
 *
 * Ce chemin est un filet de sécurité, pas le chemin nominal : il rattrape les
 * webhooks en retard, et le développement en local où Moneroo ne peut pas
 * joindre la machine. Le crédit reste exactement-une-fois grâce à la RPC
 * `grant_credits_for_payment` (garde `WHERE status = 'pending'`).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const { id: paymentId } = await params;
  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();

  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable." }, { status: 404 });
  }

  // Un utilisateur ne consulte que ses propres paiements.
  if (payment.user_id !== user.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  let status: string = payment.status;
  let justCredited = false;

  const secretKey = getMonerooSecretKey();
  if (status === "pending" && secretKey && payment.provider_transaction_id) {
    const live = await verifyPayment(payment.provider_transaction_id, secretKey);

    if (live?.status === "success") {
      // Contrôle anti-falsification : Moneroo règle en totalité, tout écart
      // de montant ou de devise est suspect.
      const amountMatches = live.amount === undefined || live.amount === payment.amount_total;
      const currencyMatches =
        live.currency === undefined || live.currency === payment.currency;

      if (!amountMatches || !currencyMatches) {
        console.error(
          `[MONEROO] Écart de montant sur ${paymentId} : attendu ${payment.amount_total} ${payment.currency}, reçu ${live.amount} ${live.currency}`
        );
        await supabase
          .from("payments")
          .update({
            status: "failed",
            failure_reason: "Écart de montant détecté à la vérification",
            updated_at: new Date().toISOString(),
          })
          .eq("id", paymentId)
          .eq("status", "pending");
        status = "failed";
      } else {
        const granted = await grantCreditsForPayment(supabase, paymentId);
        if (granted.granted) justCredited = true;
        status = "completed";
      }
    } else if (live && ["failed", "cancelled"].includes(live.status)) {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          failure_reason: `Paiement ${live.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("status", "pending");
      status = "failed";
    }
  }

  return NextResponse.json({
    id: payment.id,
    status,
    justCredited,
    credits: payment.credits_purchased,
    amount: payment.amount_total,
    currency: payment.currency,
    packId: payment.pack_id,
    failureReason: payment.failure_reason,
    balance: await getBalance(supabase, user.id),
  });
}
