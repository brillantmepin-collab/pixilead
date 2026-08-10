import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { apify } from "@/lib/apify/client";
import { mapPlaceToLead } from "@/lib/apify/mapper";
import { generateDemoLeads } from "@/lib/demo-data";
import { refundCredits } from "@/lib/credits-server";
import { SEARCH_CREDIT_COST } from "@/lib/credits";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;
    const supabase = createAdminClient();

    const { data: search, error } = await supabase
      .from("searches")
      .select("*")
      .eq("id", searchId)
      .single();

    if (error || !search) {
      return NextResponse.json({ error: "Recherche introuvable" }, { status: 404 });
    }

    // Fast exit if already finished
    if (search.status !== "running") {
      return NextResponse.json({
        id: search.id,
        status: search.status,
        sector: search.sector,
        city: search.city,
        resultsCount: search.results_count,
        errorMessage: search.error_message,
      });
    }

    const apifyRunId = search.apify_run_id;
    const apifyDatasetId = search.apify_dataset_id;

    // Handle Demo / Mock mode if no live Apify run ID
    if (!apifyRunId || apifyRunId.startsWith("demo_run_")) {
      console.log(`[⚡ DEMO EXECUTING] Génération des leads de démonstration pour ${search.sector} à ${search.city}...`);
      const demoItems = generateDemoLeads(search.sector, search.city);
      const mappedLeads = demoItems.map((item) => mapPlaceToLead(item, searchId, search.user_id));

      if (mappedLeads.length > 0) {
        await supabase
          .from("leads")
          .upsert(mappedLeads, { onConflict: "search_id,place_id" });
      }

      await supabase
        .from("searches")
        .update({
          status: "succeeded",
          results_count: mappedLeads.length,
          completed_at: new Date().toISOString(),
        })
        .eq("id", searchId);

      console.log(`[✅ DEMO SUCCESS] ${mappedLeads.length} leads de démo enregistrés pour la recherche ID: ${searchId}`);

      return NextResponse.json({
        id: search.id,
        status: "succeeded",
        sector: search.sector,
        city: search.city,
        resultsCount: mappedLeads.length,
      });
    }

    // Live Apify execution polling
    try {
      console.log(`[🔍 APIFY CHECK] Vérification de l'état du Run Apify ID: ${apifyRunId}...`);
      const run = await apify.run(apifyRunId).get();
      const runStatus = run?.status;
      console.log(`[📊 APIFY RUN STATUS] ${runStatus}`);

      if (runStatus === "SUCCEEDED" && apifyDatasetId) {
        console.log(`[📥 APIFY DATASET] Extraction du dataset ID: ${apifyDatasetId}...`);
        const dataset = await apify.dataset(apifyDatasetId).listItems();
        const items = dataset.items || [];
        const mappedLeads = items.map((item) => mapPlaceToLead(item, searchId, search.user_id));

        console.log(`[💾 SUPABASE SAVE] ${mappedLeads.length} fiches réelles extraites ! Sauvegarde dans Supabase...`);

        if (mappedLeads.length > 0) {
          await supabase
            .from("leads")
            .upsert(mappedLeads, { onConflict: "search_id,place_id" });
        }

        await supabase
          .from("searches")
          .update({
            status: "succeeded",
            results_count: mappedLeads.length,
            completed_at: new Date().toISOString(),
          })
          .eq("id", searchId);

        console.log(`[🎉 SCRAPE COMPLETED] Recherche ID ${searchId} terminée avec ${mappedLeads.length} leads !`);

        return NextResponse.json({
          id: search.id,
          status: "succeeded",
          sector: search.sector,
          city: search.city,
          resultsCount: mappedLeads.length,
        });
      }

      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus || "")) {
        // `.eq("status", "running")` + `.select()` : seul le premier appel qui
        // fait effectivement basculer la ligne rembourse. Sans ce garde-fou,
        // le polling toutes les 3 s rembourserait en boucle.
        const { data: transitioned } = await supabase
          .from("searches")
          .update({
            status: "failed",
            error_message: `Le scrape Apify a échoué (${runStatus})`,
          })
          .eq("id", searchId)
          .eq("status", "running")
          .select("id");

        if (transitioned && transitioned.length > 0 && search.user_id) {
          const balance = await refundCredits(
            supabase,
            search.user_id,
            SEARCH_CREDIT_COST,
            "refund_search",
            "search",
            searchId
          );
          console.log(
            `[💳 CRÉDITS] Scrape échoué — ${SEARCH_CREDIT_COST} crédits remboursés | Solde: ${balance}`
          );
        }

        return NextResponse.json({
          id: search.id,
          status: "failed",
          errorMessage: `Le scrape Apify a échoué (${runStatus})`,
        });
      }

      // Still running
      return NextResponse.json({
        id: search.id,
        status: "running",
        sector: search.sector,
        city: search.city,
      });
    } catch (err: any) {
      console.warn("Apify status check failed:", err);
      return NextResponse.json({
        id: search.id,
        status: "running",
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erreur serveur" }, { status: 500 });
  }
}
