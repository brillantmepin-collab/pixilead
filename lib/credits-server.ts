import { createAdminClient } from "@/lib/supabase/server";
import { SIGNUP_FREE_CREDITS } from "@/lib/credits";
import type { AuthedUser } from "@/lib/auth";

/**
 * Opérations de crédits côté serveur.
 *
 * Toutes passent par des RPC Postgres (voir
 * lib/supabase/migrations/001_credits_moneroo.sql) : le débit conditionnel et
 * le fulfillment de paiement doivent être atomiques, un aller-retour
 * lecture-puis-écriture depuis Node laisserait une fenêtre de course pendant
 * laquelle le solde peut passer en négatif ou être crédité deux fois.
 */

type Supabase = ReturnType<typeof createAdminClient>;

/** Crée la ligne profil si elle manque (comptes antérieurs au trigger). */
export async function ensureProfile(
  supabase: Supabase,
  user: AuthedUser
): Promise<void> {
  await supabase.rpc("ensure_profile", {
    p_user_id: user.id,
    p_full_name: user.fullName,
  });
}

export async function getBalance(
  supabase: Supabase,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  return typeof data?.credits === "number" ? data.credits : 0;
}

export async function getProfileCountry(
  supabase: Supabase,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("country")
    .eq("id", userId)
    .single();
  return data?.country || "CM";
}

export type ConsumeResult =
  | { ok: true; balance: number }
  | { ok: false; balance: number };

/**
 * Débit atomique. Renvoie `ok: false` (avec le solde courant) si le solde est
 * insuffisant — la RPC ne modifie alors rien.
 */
export async function consumeCredits(
  supabase: Supabase,
  userId: string,
  amount: number,
  reason: string,
  referenceType?: string,
  referenceId?: string
): Promise<ConsumeResult> {
  const { data, error } = await supabase.rpc("consume_credits_for", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_type: referenceType ?? null,
    p_reference_id: referenceId ?? null,
  });

  if (error) {
    console.error("[CRÉDITS] Échec du débit:", error.message);
    return { ok: false, balance: await getBalance(supabase, userId) };
  }

  // La RPC renvoie le nouveau solde, ou NULL si le débit a été refusé.
  if (typeof data !== "number") {
    return { ok: false, balance: await getBalance(supabase, userId) };
  }
  return { ok: true, balance: data };
}

/** Remboursement (recherche échouée). Toujours accordé. */
export async function refundCredits(
  supabase: Supabase,
  userId: string,
  amount: number,
  reason: string,
  referenceType?: string,
  referenceId?: string
): Promise<number | null> {
  const { data, error } = await supabase.rpc("refund_credits_to", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_type: referenceType ?? null,
    p_reference_id: referenceId ?? null,
  });
  if (error) {
    console.error("[CRÉDITS] Échec du remboursement:", error.message);
    return null;
  }
  return typeof data === "number" ? data : null;
}

export type GrantResult = {
  granted: boolean;
  reason?: string;
  credits?: number;
  balance?: number;
};

/**
 * Fulfillment d'un paiement : bascule pending → completed et crédite le solde
 * en une seule transaction. Rejouable — le second appel renvoie
 * `{ granted: false, reason: "already_processed" }`.
 */
export async function grantCreditsForPayment(
  supabase: Supabase,
  paymentId: string
): Promise<GrantResult> {
  const { data, error } = await supabase.rpc("grant_credits_for_payment", {
    p_payment_id: paymentId,
  });
  if (error) {
    console.error("[CRÉDITS] Échec du fulfillment:", error.message);
    return { granted: false, reason: error.message };
  }
  return (data as GrantResult) ?? { granted: false, reason: "unknown" };
}

export { SIGNUP_FREE_CREDITS };
