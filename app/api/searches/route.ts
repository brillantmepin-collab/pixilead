import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { apify, GOOGLE_MAPS_ACTOR } from "@/lib/apify/client";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  insufficientCreditsResponse,
} from "@/lib/auth";
import {
  ensureProfile,
  consumeCredits,
  refundCredits,
  getBalance,
} from "@/lib/credits-server";
import { SEARCH_CREDIT_COST } from "@/lib/credits";
import { z } from "zod";

export const runtime = "nodejs";

const searchSchema = z.object({
  sector: z.string().min(2, "Le secteur doit contenir au moins 2 caractères"),
  city: z.string().min(2, "La ville doit contenir au moins 2 caractères"),
  country: z.string().default("Cameroun"),
  maxResults: z.number().min(1).max(100).default(50),
});

export async function POST(request: NextRequest) {
  try {
    // Une recherche coûte des crédits : l'identité de l'appelant n'est plus
    // optionnelle.
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const parsed = searchSchema.parse(body);

    const adminSupabase = createAdminClient();
    await ensureProfile(adminSupabase, user);

    // Insert search record in 'running' status
    const { data: searchRecord, error: searchInsertErr } = await adminSupabase
      .from("searches")
      .insert({
        user_id: user.id,
        sector: parsed.sector,
        city: parsed.city,
        country: parsed.country,
        max_results: parsed.maxResults,
        status: "running",
      })
      .select("id")
      .single();

    if (searchInsertErr || !searchRecord) {
      console.error("Supabase search insert error:", searchInsertErr);
      return NextResponse.json({ error: "Erreur lors de la création de la recherche." }, { status: 500 });
    }

    const searchId = searchRecord.id;

    // Débit AVANT le lancement du crawler : on ne veut pas consommer de quota
    // Apify pour un utilisateur qui n'a pas les crédits.
    const debit = await consumeCredits(
      adminSupabase,
      user.id,
      SEARCH_CREDIT_COST,
      "search",
      "search",
      searchId
    );

    if (!debit.ok) {
      await adminSupabase
        .from("searches")
        .update({
          status: "failed",
          error_message: "Crédits insuffisants",
        })
        .eq("id", searchId);

      return insufficientCreditsResponse(SEARCH_CREDIT_COST, debit.balance);
    }

    console.log(`\n=======================================================`);
    console.log(`[🚀 PIXILEAD API] Nouvelle recherche enregistrée ID: ${searchId}`);
    console.log(`[📍 CRITÈRES] Secteur: "${parsed.sector}" | Ville: "${parsed.city}" | Pays: "${parsed.country}" | Max Leads: ${parsed.maxResults}`);
    console.log(`[💳 CRÉDITS] -${SEARCH_CREDIT_COST} crédits | Solde restant: ${debit.balance}`);

    // Start Apify actor asynchronously
    const apifyToken = process.env.APIFY_TOKEN;
    if (apifyToken && !apifyToken.includes("placeholder")) {
      try {
        console.log(`[📡 APIFY RUN] Lancement du crawler Google Maps (Actor: ${GOOGLE_MAPS_ACTOR})...`);
        const run = await apify.actor(GOOGLE_MAPS_ACTOR).start({
          searchStringsArray: [`${parsed.sector} à ${parsed.city}, ${parsed.country}`],
          maxCrawledPlacesPerSearch: parsed.maxResults,
          language: "fr",
        });

        console.log(`[✅ APIFY STARTED] Run ID: ${run.id} | Dataset ID: ${run.defaultDatasetId}`);

        await adminSupabase
          .from("searches")
          .update({
            apify_run_id: run.id,
            apify_dataset_id: run.defaultDatasetId,
          })
          .eq("id", searchId);
      } catch (apifyErr: any) {
        console.error("❌ [APIFY ERROR] Échec du lancement de l'acteur:", apifyErr.message || apifyErr);

        // Le crawler n'a jamais démarré : on rend les crédits immédiatement.
        const balance = await refundCredits(
          adminSupabase,
          user.id,
          SEARCH_CREDIT_COST,
          "refund_search",
          "search",
          searchId
        );
        console.log(`[💳 CRÉDITS] Remboursement de ${SEARCH_CREDIT_COST} crédits | Solde: ${balance}`);

        await adminSupabase
          .from("searches")
          .update({
            status: "failed",
            error_message: apifyErr.message || "Erreur de communication avec Apify.",
          })
          .eq("id", searchId);

        return NextResponse.json(
          {
            error:
              "Le lancement du scraping a échoué. Vos crédits ont été remboursés.",
          },
          { status: 502 }
        );
      }
    } else {
      console.log(`[⚡ DEMO MODE] Token Apify non présent -> Mode démo instantané activé.`);
      await adminSupabase
        .from("searches")
        .update({
          apify_run_id: `demo_run_${searchId}`,
          apify_dataset_id: `demo_dataset_${searchId}`,
        })
        .eq("id", searchId);
    }

    return NextResponse.json({
      searchId,
      status: "running",
      creditsSpent: SEARCH_CREDIT_COST,
      balance: debit.balance,
    });
  } catch (err: any) {
    console.error("POST /api/searches handler error:", err);
    return NextResponse.json({ error: err?.message || "Erreur lors du traitement de la requête" }, { status: 400 });
  }
}

/** Solde courant — utilisé par le formulaire pour désactiver le bouton en amont. */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return unauthorizedResponse();

  const supabase = createAdminClient();
  await ensureProfile(supabase, user);

  return NextResponse.json({
    balance: await getBalance(supabase, user.id),
    cost: SEARCH_CREDIT_COST,
  });
}
