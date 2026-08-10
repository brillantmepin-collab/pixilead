import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth";
import { ensureProfile } from "@/lib/credits-server";
import {
  CREDIT_PACKS,
  currencyForCountry,
  packAmount,
  SEARCH_CREDIT_COST,
  AI_MESSAGE_CREDIT_COST,
} from "@/lib/credits";

export const runtime = "nodejs";

/** Solde de crédits, devise de facturation, packs disponibles et historique. */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const supabase = createAdminClient();
  await ensureProfile(supabase, user);

  const { data: profile } = await supabase
    .from("profiles")
    .select("credits, country")
    .eq("id", user.id)
    .single();

  const balance = typeof profile?.credits === "number" ? profile.credits : 0;
  const country = profile?.country || "CM";
  const currency = currencyForCountry(country);

  const { data: transactions } = await supabase
    .from("credit_transactions")
    .select("id, delta, balance_after, reason, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    balance,
    country,
    currency,
    costs: {
      search: SEARCH_CREDIT_COST,
      aiMessage: AI_MESSAGE_CREDIT_COST,
    },
    packs: CREDIT_PACKS.map((pack) => ({
      id: pack.id,
      name: pack.name,
      credits: pack.credits,
      tagline: pack.tagline,
      popular: Boolean(pack.popular),
      amount: packAmount(pack, currency),
      currency,
    })),
    transactions: transactions || [],
  });
}
