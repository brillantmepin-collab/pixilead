"use client";

import { useState } from "react";
import { Download, MapPin, Globe, Phone, Star, MessageSquare, ExternalLink, Sparkles, Filter, Check, X, Loader2 } from "lucide-react";
import { getWhatsAppLink } from "@/lib/phone";
import { authFetch, readApiError } from "@/lib/supabase/auth-fetch";
import { MessageModal, MessageVariant } from "./message-modal";

export interface LeadItem {
  id: string;
  name: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  maps_url?: string | null;
}

interface LeadsTableProps {
  searchId: string;
  sector: string;
  city: string;
  country?: string;
  leads: LeadItem[];
}

export function LeadsTable({ searchId, sector, city, country = "Cameroun", leads }: LeadsTableProps) {
  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterWebsite, setFilterWebsite] = useState<boolean | null>(null); // null = all, true = has website, false = no website
  const [filterPhone, setFilterPhone] = useState<boolean | null>(null);
  const [filterLowRating, setFilterLowRating] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"default" | "reviews" | "rating">("default");

  // Modal AI state
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [generatedMessages, setGeneratedMessages] = useState<MessageVariant[]>([]);
  const [generatingLeadId, setGeneratingLeadId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Export CSV
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Statistics calculation
  const totalLeads = leads.length;
  const withWebsiteCount = leads.filter((l) => Boolean(l.website)).length;
  const withPhoneCount = leads.filter((l) => Boolean(l.phone)).length;
  const noWebsiteWithPhoneCount = leads.filter((l) => !l.website && Boolean(l.phone)).length;

  const validRatings = leads.filter((l) => typeof l.rating === "number" && l.rating! > 0);
  const avgRating = validRatings.length > 0
    ? (validRatings.reduce((acc, l) => acc + (l.rating || 0), 0) / validRatings.length).toFixed(2)
    : "N/A";

  const totalReviews = leads.reduce((acc, l) => acc + (l.reviews_count || 0), 0);

  // Filter application
  let filteredLeads = leads.filter((l) => {
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const matchName = l.name.toLowerCase().includes(term);
      const matchAddress = (l.address || "").toLowerCase().includes(term);
      const matchCategory = (l.category || "").toLowerCase().includes(term);
      if (!matchName && !matchAddress && !matchCategory) return false;
    }
    if (filterWebsite === true && !l.website) return false;
    if (filterWebsite === false && l.website) return false;
    if (filterPhone === true && !l.phone) return false;
    if (filterPhone === false && l.phone) return false;
    if (filterLowRating && ((l.rating || 5) >= 4.0)) return false;
    return true;
  });

  // Sort application
  if (sortBy === "reviews") {
    filteredLeads = [...filteredLeads].sort((a, b) => (b.reviews_count || 0) - (a.reviews_count || 0));
  } else if (sortBy === "rating") {
    filteredLeads = [...filteredLeads].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  const handleOpenMessageModal = (lead: LeadItem) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  // Une navigation `window.location.href` ne peut pas porter l'en-tête
  // Authorization : on télécharge le CSV via fetch authentifié puis on
  // déclenche l'enregistrement depuis le blob.
  const handleDownloadCsv = async () => {
    setExportError(null);
    setExporting(true);
    try {
      const res = await authFetch(`/api/searches/${searchId}/export`);
      if (!res.ok) {
        const err = await readApiError(res);
        setExportError(
          err.needsLogin
            ? "Connectez-vous pour exporter vos leads."
            : err.message
        );
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pixilead-${sector}-${city}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/gi, "_")
        .concat(".csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Impossible de générer l'export CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header Banner styled like Laplead */}
      <div className="bg-[#122b22] border border-emerald-500/25 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Il y a {totalLeads} {sector}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1 text-slate-200 font-medium">
              <MapPin className="w-4 h-4 text-emerald-400" />
              {city}, {country}
            </span>
            <span>•</span>
            <span>Dernière mise à jour aujourd'hui</span>
          </div>
        </div>

        {/* Stat Summary Pills */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="bg-[#0b1915] border border-emerald-500/30 rounded-full px-4 py-2 text-slate-200">
            <strong className="text-emerald-400">{withWebsiteCount}</strong> ont un site web
          </div>
          <div className="bg-[#0b1915] border border-emerald-500/30 rounded-full px-4 py-2 text-slate-200">
            <strong className="text-emerald-400">{withPhoneCount}</strong> ont un téléphone
          </div>
          <div className="bg-amber-950/80 border border-amber-500/40 rounded-full px-4 py-2 text-amber-200 font-medium">
            <strong className="text-amber-400">{noWebsiteWithPhoneCount}</strong> sans site avec téléphone (Signal Fort)
          </div>
          <div className="bg-[#0b1915] border border-emerald-500/30 rounded-full px-4 py-2 text-slate-200">
            <strong className="text-emerald-400">{avgRating}</strong> Note moyenne
          </div>
          <div className="bg-[#0b1915] border border-emerald-500/30 rounded-full px-4 py-2 text-slate-200">
            <strong className="text-emerald-400">{totalReviews}</strong> Total avis
          </div>
        </div>

        {/* 2. Download Action Bar */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-emerald-900/60">
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadCsv}
              disabled={exporting}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-6 py-3.5 rounded-2xl shadow-xl shadow-rose-950/50 transition-all flex items-center gap-2 text-sm transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Génération du CSV…</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Télécharger la liste (CSV)</span>
                </>
              )}
            </button>
            {exportError ? (
              <span className="text-xs text-rose-300 font-semibold">
                {exportError}
              </span>
            ) : (
              <span className="text-xs text-slate-400 hidden lg:inline">
                Cliquez pour exporter toutes les données pour Excel
              </span>
            )}
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-4">
            <span>Téléchargements: <strong className="text-white">1</strong></span>
            <span>Vues totales: <strong className="text-white">{totalLeads}</strong></span>
          </div>
        </div>

        {/* 3. Live Search Input & Filter Pills */}
        <div className="pt-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-t border-emerald-900/40">
          {/* Live Search Input */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, adresse ou mot-clé..."
              className="w-full bg-[#061a12] border border-emerald-800/80 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1">Filtres:</span>

            {/* Filter website */}
            <button
              onClick={() => setFilterWebsite(filterWebsite === true ? null : true)}
              className={`px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                filterWebsite === true
                  ? "bg-emerald-500 text-slate-950 font-bold border-emerald-400"
                  : "bg-[#0e3023] text-slate-300 border-emerald-800 hover:border-emerald-600"
              }`}
            >
              Avec site web {filterWebsite === true && <X className="w-3 h-3" />}
            </button>

            <button
              onClick={() => setFilterWebsite(filterWebsite === false ? null : false)}
              className={`px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                filterWebsite === false
                  ? "bg-amber-500 text-slate-950 font-bold border-amber-400"
                  : "bg-[#0e3023] text-slate-300 border-emerald-800 hover:border-emerald-600"
              }`}
            >
              Sans site web {filterWebsite === false && <X className="w-3 h-3" />}
            </button>

            {/* Filter phone */}
            <button
              onClick={() => setFilterPhone(filterPhone === true ? null : true)}
              className={`px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                filterPhone === true
                  ? "bg-emerald-500 text-slate-950 font-bold border-emerald-400"
                  : "bg-[#0e3023] text-slate-300 border-emerald-800 hover:border-emerald-600"
              }`}
            >
              Avec téléphone {filterPhone === true && <X className="w-3 h-3" />}
            </button>

            {/* Filter rating */}
            <button
              onClick={() => setFilterLowRating(!filterLowRating)}
              className={`px-3.5 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${
                filterLowRating
                  ? "bg-rose-500 text-white font-bold border-rose-400"
                  : "bg-[#0e3023] text-slate-300 border-emerald-800 hover:border-emerald-600"
              }`}
            >
              Note &lt; 4 {filterLowRating && <X className="w-3 h-3" />}
            </button>
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Trier par:</span>
            <button
              onClick={() => setSortBy("default")}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                sortBy === "default"
                  ? "bg-white text-slate-900 font-bold border-white"
                  : "bg-[#0e3023] text-slate-300 border-emerald-800"
              }`}
            >
              Ordre initial
            </button>
            <button
              onClick={() => setSortBy("reviews")}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                sortBy === "reviews"
                  ? "bg-white text-slate-900 font-bold border-white"
                  : "bg-[#0e3023] text-slate-300 border-emerald-800"
              }`}
            >
              Nombre d'avis
            </button>
            <button
              onClick={() => setSortBy("rating")}
              className={`px-3 py-1.5 rounded-xl border transition-all ${
                sortBy === "rating"
                  ? "bg-white text-slate-900 font-bold border-white"
                  : "bg-[#0e3023] text-slate-300 border-emerald-800"
              }`}
            >
              Note Google
            </button>
          </div>
        </div>
      </div>

      {/* 4. White Card Table Container styled like Laplead */}
      <div className="bg-white rounded-t-3xl rounded-b-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                <th className="py-4 px-6">Nom</th>
                <th className="py-4 px-4">Téléphone</th>
                <th className="py-4 px-4">Catégorie</th>
                <th className="py-4 px-4">Site Web</th>
                <th className="py-4 px-4">Note & Avis</th>
                <th className="py-4 px-4">Google Maps</th>
                <th className="py-4 px-6 text-right">Prospection IA</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Aucun lead ne correspond aux filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const waUrl = getWhatsAppLink(lead.phone);
                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">
                          {lead.name}
                        </div>
                        {lead.address && (
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {lead.address}
                          </div>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {lead.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-900 font-semibold">{lead.phone}</span>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Ouvrir WhatsApp direct"
                                className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors"
                              >
                                WA Direct
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Non disponible</span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-lg text-[11px]">
                          {lead.category || sector}
                        </span>
                      </td>

                      {/* Website */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {lead.website ? (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-700 hover:underline flex items-center gap-1 max-w-[160px] truncate"
                          >
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, '')}</span>
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            Pas de site web
                          </span>
                        )}
                      </td>

                      {/* Rating */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {typeof lead.rating === "number" ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center text-amber-500 font-bold">
                              <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-500 mr-0.5" />
                              {lead.rating.toFixed(1)}
                            </div>
                            {typeof lead.reviews_count === "number" && (
                              <span className="text-slate-400 text-[11px]">({lead.reviews_count})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Maps URL */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {lead.maps_url ? (
                          <a
                            href={lead.maps_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center gap-1 text-[11px] underline"
                          >
                            Voir sur Maps
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* IA Generator */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenMessageModal(lead)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md shadow-emerald-200 transition-all inline-flex items-center gap-1.5 transform hover:scale-105"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>Message IA</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Message Modal */}
      {selectedLead && (
        <MessageModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          leadId={selectedLead.id}
          leadName={selectedLead.name}
          leadPhone={selectedLead.phone}
          leadEmail={selectedLead.email}
          hasWebsite={Boolean(selectedLead.website)}
        />
      )}
    </div>
  );
}
