import { Navbar } from "@/components/layout/navbar";
import { LeadsTable, LeadItem } from "@/components/leads/leads-table";
import { createAdminClient } from "@/lib/supabase/server";
import { generateDemoLeads } from "@/lib/demo-data";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function SearchResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: searchId } = await params;
  const supabase = createAdminClient();

  let sector = "Recherche";
  let city = "Ville";
  let country = "Cameroun";
  let leads: LeadItem[] = [];

  if (searchId === "demo_landing") {
    leads = generateDemoLeads(sector, city).map((item, idx) => ({
      id: `demo_${idx}`,
      name: item.title || "Entreprise",
      category: item.categoryName || sector,
      address: item.address,
      city: item.city,
      phone: item.phone,
      website: item.website,
      email: item.emails?.[0],
      rating: item.totalScore,
      reviews_count: item.reviewsCount,
      maps_url: item.url,
    }));
  } else {
    // Fetch search info
    const { data: search } = await supabase
      .from("searches")
      .select("*")
      .eq("id", searchId)
      .single();

    if (search) {
      sector = search.sector;
      city = search.city;
      country = search.country || "Cameroun";
    }

    // Fetch leads
    const { data: leadRows } = await supabase
      .from("leads")
      .select("*")
      .eq("search_id", searchId)
      .order("created_at", { ascending: true });

    if (leadRows && leadRows.length > 0) {
      leads = leadRows.map((l: any) => ({
        id: l.id,
        name: l.name,
        category: l.category,
        address: l.address,
        city: l.city,
        phone: l.phone,
        website: l.website,
        email: l.email,
        rating: typeof l.rating === "number" ? l.rating : l.rating ? Number(l.rating) : null,
        reviews_count: l.reviews_count,
        maps_url: l.maps_url,
      }));
    } else {
      // Fallback demo leads if search has no stored leads yet
      leads = generateDemoLeads(sector, city).map((item, idx) => ({
        id: `demo_fallback_${idx}`,
        name: item.title || "Entreprise",
        category: item.categoryName || sector,
        address: item.address,
        city: item.city,
        phone: item.phone,
        website: item.website,
        email: item.emails?.[0],
        rating: item.totalScore,
        reviews_count: item.reviewsCount,
        maps_url: item.url,
      }));
    }
  }

  return (
    <div className="min-h-screen bg-[#061a12] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href="/app"
            className="text-xs font-semibold text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour aux recherches</span>
          </Link>
        </div>

        <LeadsTable
          searchId={searchId}
          sector={sector}
          city={city}
          country={country}
          leads={leads}
        />
      </main>
    </div>
  );
}
