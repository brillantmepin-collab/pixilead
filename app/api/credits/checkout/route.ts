import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth";
import { ensureProfile, getProfileCountry } from "@/lib/credits-server";
import { getCreditPack, currencyForCountry, packAmount } from "@/lib/credits";
import {
  initiatePayment,
  getMonerooSecretKey,
} from "@/lib/moneroo/client";

export const runtime = "nodejs";
export const maxDuration = 30;

const checkoutSchema = z.object({
  packId: z.string().min(1),
  phone: z.string().trim().max(20).optional(),
});

/**
 * Ouvre un paiement Moneroo pour un pack de crédits.
 *
 * Invariant du skill : la ligne `payments` est insérée en `pending` AVANT
 * l'appel au fournisseur — le webhook peut arriver avant même que la réponse
 * HTTP ne soit revenue jusqu'au navigateur.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  // Moneroo exige un email client : sans lui, l'API renvoie un 400 silencieux.
  if (!user.email) {
    return NextResponse.json(
      {
        error:
          "Votre compte n'a pas d'adresse email : impossible d'ouvrir un paiement.",
      },
      { status: 400 }
    );
  }

  let parsed: z.infer<typeof checkoutSchema>;
  try {
    parsed = checkoutSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const pack = getCreditPack(parsed.packId);
  if (!pack) {
    return NextResponse.json(
      { error: "Pack de crédits inconnu." },
      { status: 400 }
    );
  }

  const secretKey = getMonerooSecretKey();
  if (!secretKey) {
    return NextResponse.json(
      {
        error:
          "Le paiement n'est pas encore configuré sur ce serveur (MONEROO_SECRET_KEY manquante).",
        code: "moneroo_not_configured",
      },
      { status: 503 }
    );
  }

  const supabase = createAdminClient();
  await ensureProfile(supabase, user);

  // Le prix est TOUJOURS relu depuis le catalogue serveur : le client n'envoie
  // qu'un packId, jamais un montant.
  const country = await getProfileCountry(supabase, user.id);
  const currency = currencyForCountry(country);
  const amount = packAmount(pack, currency);

  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      user_id: user.id,
      provider: "moneroo",
      pack_id: pack.id,
      credits_purchased: pack.credits,
      amount_total: amount,
      currency,
      status: "pending",
      customer_email: user.email,
      metadata: { country, packName: pack.name },
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    console.error("[MONEROO] Insertion du paiement impossible:", insertError);
    return NextResponse.json(
      { error: "Impossible de créer le paiement." },
      { status: 500 }
    );
  }

  // Moneroo n'a pas de `cancel_url` : `return_url` est la seule redirection.
  // On utilise `ref` (et pas `paymentId`) car Moneroo ajoute lui-même
  // `?paymentId=...&paymentStatus=...` à l'URL de retour.
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const returnUrl = `${origin}/app/credits/retour?ref=${payment.id}`;

  const result = await initiatePayment(
    {
      amount,
      currency,
      description: `PixiLead — Pack ${pack.name} (${pack.credits} crédits)`,
      returnUrl,
      customerEmail: user.email,
      customerName: user.fullName || undefined,
      customerPhone: parsed.phone,
      metadata: {
        paymentId: payment.id,
        userId: user.id,
        packId: pack.id,
      },
    },
    secretKey
  );

  if (!result.ok) {
    await supabase
      .from("payments")
      .update({
        status: "failed",
        failure_reason: result.error,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    console.error("[MONEROO] Échec de l'initialisation:", result.error);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await supabase
    .from("payments")
    .update({
      provider_transaction_id: result.providerTransactionId,
      checkout_url: result.checkoutUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  console.log(
    `[💳 MONEROO] Paiement ${payment.id} ouvert — ${pack.credits} crédits, ${amount} ${currency}`
  );

  return NextResponse.json({
    paymentId: payment.id,
    checkoutUrl: result.checkoutUrl,
    amount,
    currency,
    credits: pack.credits,
  });
}
