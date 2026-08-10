import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth";
import { generateLeadsCsv, LeadForCsv } from "@/lib/csv";

export const runtime = "nodejs";

/**
 * Export CSV des leads d'une recherche.
 *
 * Cette route lisait auparavant via le client anon sans session : la RLS
 * (`auth.uid() = user_id`) ne matchait aucune ligne et le fichier repartait
 * vide. Elle passe désormais par l'identité Bearer (voir lib/auth.ts) avec un
 * contrôle de propriété explicite — les leads sont payants, ils ne doivent
 * sortir que pour leur propriétaire.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const { id: searchId } = await params;
    const supabase = createAdminClient();

    const { data: search } = await supabase
      .from("searches")
      .select("sector, city, user_id")
      .eq("id", searchId)
      .single();

    if (!search) {
      return NextResponse.json({ error: "Recherche introuvable." }, { status: 404 });
    }
    if (search.user_id && search.user_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const sector = search.sector || "leads";
    const city = search.city || "export";

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("search_id", searchId)
      .order("created_at", { ascending: true });

    if (error || !leads) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération des leads." },
        { status: 500 }
      );
    }

    // Rattache le dernier message IA généré à chaque fiche.
    const leadRows = leads as Record<string, any>[];
    const leadIds = leadRows.map((l) => l.id as string);

    const messageMap = new Map<string, string>();
    if (leadIds.length > 0) {
      const { data: messages } = await supabase
        .from("messages")
        .select("lead_id, content")
        .in("lead_id", leadIds);

      (messages as { lead_id: string; content: string }[] | null)?.forEach((m) => {
        if (!messageMap.has(m.lead_id)) {
          messageMap.set(m.lead_id, m.content);
        }
      });
    }

    const leadsForCsv: LeadForCsv[] = leadRows.map((lead) => ({
      name: lead.name,
      category: lead.category,
      phone: lead.phone,
      website: lead.website,
      email: lead.email,
      address: lead.address,
      city: lead.city,
      rating: lead.rating,
      reviews_count: lead.reviews_count,
      maps_url: lead.maps_url,
      generated_message: messageMap.get(lead.id) || null,
    }));

    const csvContent = generateLeadsCsv(leadsForCsv);

    const safeSector = sector.toLowerCase().replace(/[^a-z0-9]/gi, "_");
    const safeCity = city.toLowerCase().replace(/[^a-z0-9]/gi, "_");
    const filename = `pixilead-${safeSector}-${safeCity}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Erreur export CSV" },
      { status: 500 }
    );
  }
}
