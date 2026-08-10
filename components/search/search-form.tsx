"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, MapPin, Building2, Loader2, Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Radio, Database, Cpu, Server, Sliders, Minus, Plus, Coins } from "lucide-react";
import { authFetch, readApiError } from "@/lib/supabase/auth-fetch";
import { SEARCH_CREDIT_COST, CREDITS_EVENT } from "@/lib/credits";

export function SearchForm() {
  const router = useRouter();
  const [sector, setSector] = useState("Agence digitale");
  const [city, setCity] = useState("Yaoundé");
  const [country, setCountry] = useState("Cameroun");
  const [maxResults, setMaxResults] = useState(5);

  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [progressPercent, setProgressPercent] = useState(15);
  const [statusText, setStatusText] = useState("");
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [blockedReason, setBlockedReason] = useState<"login" | "credits" | null>(null);

  // Solde courant, pour prévenir l'utilisateur avant même qu'il ne soumette.
  useEffect(() => {
    let cancelled = false;
    authFetch("/api/searches")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setBlockedReason("login");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (typeof data.balance === "number") setBalance(data.balance);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Progressive step animation during active loading
  useEffect(() => {
    let stepTimer: NodeJS.Timeout;
    if (loading) {
      setActiveStep(1);
      setProgressPercent(20);

      stepTimer = setInterval(() => {
        setActiveStep((prev) => {
          if (prev < 3) {
            const next = prev + 1;
            setProgressPercent(next === 2 ? 55 : 85);
            return next;
          }
          return prev;
        });
      }, 4000);
    } else {
      setActiveStep(1);
      setProgressPercent(15);
    }

    return () => clearInterval(stepTimer);
  }, [loading]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (activeSearchId && loading) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/searches/${activeSearchId}/status`);
          const data = await res.json();

          if (data.status === "succeeded") {
            clearInterval(interval);
            setActiveStep(4);
            setProgressPercent(100);
            setStatusText("Leads extraits avec succès ! Redirection vers votre tableau de bord...");
            setTimeout(() => {
              router.push(`/app/recherches/${activeSearchId}`);
            }, 1000);
          } else if (data.status === "failed") {
            clearInterval(interval);
            setLoading(false);
            setErrorMsg(data.errorMessage || "Échec du scraping. Vos crédits ont été remboursés.");
          }
        } catch {
          // ignore transient poll errors
        }
      }, 3000);
    }

    return () => clearInterval(interval);
  }, [activeSearchId, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setBlockedReason(null);
    setLoading(true);
    setActiveStep(1);
    setProgressPercent(20);
    setStatusText("Initialisation du crawler Apify Google Maps...");

    try {
      const res = await authFetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector, city, country, maxResults }),
      });

      if (!res.ok) {
        const err = await readApiError(res);
        setLoading(false);
        setErrorMsg(err.message);
        if (err.needsLogin) setBlockedReason("login");
        if (err.needsCredits) {
          setBlockedReason("credits");
          if (typeof err.balance === "number") setBalance(err.balance);
        }
        return;
      }

      const data = await res.json();
      if (typeof data.balance === "number") {
        setBalance(data.balance);
        window.dispatchEvent(
          new CustomEvent(CREDITS_EVENT, { detail: { balance: data.balance } })
        );
      }
      setActiveSearchId(data.searchId);
    } catch {
      setLoading(false);
      setErrorMsg("Impossible de joindre le serveur. Vérifiez votre connexion.");
    }
  };

  const notEnoughCredits = balance !== null && balance < SEARCH_CREDIT_COST;

  const stepsList = [
    {
      id: 1,
      title: "Géolocalisation & Connexion Apify",
      desc: `Scan de la zone GPS à ${city} (${country})`,
      icon: Radio,
    },
    {
      id: 2,
      title: `Scraps en direct : ${sector}`,
      desc: `Extraction des téléphones, notes Google et adresses`,
      icon: Database,
    },
    {
      id: 3,
      title: "Filtrage & Dédoublonnage IA",
      desc: "Formatage E.164 des numéros & nettoyage des doublons",
      icon: Cpu,
    },
    {
      id: 4,
      title: "Sauvegarde Supabase & Génération",
      desc: "Stockage sécurisé et préparation de vos leads",
      icon: Server,
    },
  ];

  return (
    <div className="w-full bg-[#122b22] border border-emerald-500/25 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <Search className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-white">Lancer un nouveau scraping de leads</h2>
          <p className="text-xs text-slate-300">Google Maps scraper ultra-rapide pour l'Afrique francophone</p>
        </div>

        {balance !== null && (
          <Link
            href="/app/credits"
            title="Voir mes crédits"
            className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              notEnoughCredits
                ? "bg-rose-950/60 border-rose-700/80 text-rose-300 hover:border-rose-500"
                : "bg-[#0b1915] border-emerald-500/30 text-emerald-300 hover:border-emerald-400"
            }`}
          >
            <Coins className={`w-3.5 h-3.5 ${notEnoughCredits ? "text-rose-400" : "text-amber-400"}`} />
            <strong className="stat-number text-white">{balance}</strong>
            <span className="text-[11px] text-slate-300">
              crédit{balance > 1 ? "s" : ""}
            </span>
          </Link>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <div className="flex items-center gap-3 shrink-0">
            {blockedReason === "credits" && (
              <Link
                href="/app/credits"
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <Coins className="w-3.5 h-3.5" />
                Recharger mes crédits
              </Link>
            )}
            {blockedReason === "login" && (
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Se connecter
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            <button onClick={() => setErrorMsg(null)} className="text-xs underline font-medium">
              Fermer
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Secteur Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
              Secteur d'activité
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="ex: Agence digitale, Hôtels, Pharmacies..."
              className="w-full bg-[#0b1915] border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all disabled:opacity-50"
            />
          </div>

          {/* Ville Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              Ville
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="ex: Yaoundé, Douala, Abidjan..."
              className="w-full bg-[#0b1915] border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all disabled:opacity-50"
            />
          </div>

          {/* Pays Select */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Pays
            </label>
            <select
              disabled={loading}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full bg-[#0b1915] border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-400 transition-all disabled:opacity-50"
            >
              <option value="Cameroun">Cameroun 🇨🇲</option>
              <option value="Côte d'Ivoire">Côte d'Ivoire 🇨🇮</option>
              <option value="Sénégal">Sénégal 🇸🇳</option>
              <option value="Gabon">Gabon 🇬🇦</option>
              <option value="RDC">RDC 🇨🇩</option>
              <option value="Togo">Togo 🇹🇬</option>
              <option value="Bénin">Bénin 🇧🇯</option>
            </select>
          </div>
        </div>

        {/* Max Results Range & Scraping Filters Container */}
        <div className="bg-[#0b1915] border border-emerald-500/25 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-emerald-500/15 pb-4">
            <div className="space-y-1 w-full sm:w-auto">
              <span className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Nombre de fiches à extraire :
              </span>
              <p className="text-[11px] text-slate-300">
                Ajustez à partir de 1 fiche — la recherche coûte{" "}
                <strong className="text-amber-300">{SEARCH_CREDIT_COST} crédits</strong>, quel
                que soit le nombre de fiches
              </p>
            </div>

            {/* Unique Counter Control : Single Choice with +/- & Stepper Arrow Input */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center bg-[#122b22] border border-emerald-500/40 rounded-xl p-1 shadow-sm">
                {/* Decrement Button (-) */}
                <button
                  type="button"
                  disabled={loading || maxResults <= 1}
                  onClick={() => setMaxResults((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-lg bg-[#0b1915] text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center font-bold text-sm transition-colors disabled:opacity-30 disabled:hover:bg-[#0b1915] disabled:hover:text-emerald-400"
                  title="Diminuer (bouton du bas)"
                >
                  <Minus className="w-4 h-4" />
                </button>

                {/* Direct Numeric Input without native spin arrows */}
                <input
                  type="number"
                  min={1}
                  max={100}
                  disabled={loading}
                  value={maxResults}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setMaxResults(Math.max(1, Math.min(100, val)));
                    } else {
                      setMaxResults(1);
                    }
                  }}
                  className="w-12 bg-transparent text-center font-extrabold text-white text-sm focus:outline-none"
                />

                {/* Increment Button (+) */}
                <button
                  type="button"
                  disabled={loading || maxResults >= 100}
                  onClick={() => setMaxResults((prev) => Math.min(100, prev + 1))}
                  className="w-8 h-8 rounded-lg bg-[#0b1915] text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center font-bold text-sm transition-colors disabled:opacity-30 disabled:hover:bg-[#0b1915] disabled:hover:text-emerald-400"
                  title="Augmenter (bouton du haut)"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Dynamic Badge */}
              <span className="bg-[#122b22] text-emerald-300 font-extrabold border border-emerald-500/30 text-xs px-3 py-2 rounded-xl text-center shadow-inner whitespace-nowrap">
                {maxResults} {maxResults > 1 ? "leads" : "lead"}
              </span>
            </div>
          </div>

          {/* Advanced Scraping Target Filters */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              Filtres ciblés pour le scraping :
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Filtre 1 : Présence de Site Web */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  1. Présence de Site Web :
                </label>
                <select
                  disabled={loading}
                  className="w-full bg-[#122b22] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400 transition-all disabled:opacity-50"
                >
                  <option value="all">Tous les établissements</option>
                  <option value="no_website">Uniquement SANS site web (Opportunité forte 🔥)</option>
                  <option value="has_website">Uniquement AVEC site web</option>
                </select>
              </div>

              {/* Filtre 2 : Présence de Téléphone */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  2. Numéro de Téléphone :
                </label>
                <select
                  disabled={loading}
                  className="w-full bg-[#122b22] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400 transition-all disabled:opacity-50"
                >
                  <option value="with_phone">Uniquement avec Téléphone E.164 (Recommandé)</option>
                  <option value="all">Tous les établissements</option>
                </select>
              </div>

              {/* Filtre 3 : Note Google */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 block">
                  3. Note Google Maps :
                </label>
                <select
                  disabled={loading}
                  className="w-full bg-[#122b22] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-emerald-400 transition-all disabled:opacity-50"
                >
                  <option value="all">Toutes les notes (0 à 5 ⭐)</option>
                  <option value="low">Note &lt; 4.0 (Besoin de réputation digital)</option>
                  <option value="high">Excellentes notes &gt;= 4.0</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* REAL-TIME PROGRESS TRACKER UI WHEN SCRAPING */}
        {loading && (
          <div className="bg-[#061a12] border border-emerald-700/80 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Header & Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-300 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  Scraping en cours pour "{sector}" à {city}...
                </span>
                <span className="text-emerald-400 bg-emerald-950 border border-emerald-800 px-2.5 py-0.5 rounded-full">
                  {progressPercent}%
                </span>
              </div>

              <div className="w-full bg-[#0c241a] h-2 rounded-full overflow-hidden border border-emerald-900">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300 h-full transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Step-by-Step Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {stepsList.map((step) => {
                const IconComponent = step.icon;
                const isCompleted = activeStep > step.id;
                const isCurrent = activeStep === step.id;

                return (
                  <div
                    key={step.id}
                    className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                      isCompleted
                        ? "bg-emerald-950/80 border-emerald-700/80 text-emerald-300"
                        : isCurrent
                        ? "bg-[#0c2e20] border-emerald-500/80 text-white shadow-lg shadow-emerald-950 ring-1 ring-emerald-500/50"
                        : "bg-[#0a1f16]/60 border-emerald-950 text-slate-500 opacity-60"
                    }`}
                  >
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                      ) : (
                        <IconComponent className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <p className={`font-bold ${isCurrent ? "text-emerald-300" : isCompleted ? "text-slate-200" : "text-slate-400"}`}>
                        {step.title}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-tight">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit Button */}
        {notEnoughCredits && !loading ? (
          <Link
            href="/app/credits"
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-amber-950/50 flex items-center justify-center gap-2 text-base transition-all"
          >
            <Coins className="w-5 h-5" />
            <span>
              Crédits insuffisants ({balance}/{SEARCH_CREDIT_COST}) — Recharger
            </span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </Link>
        ) : (
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-emerald-950 flex items-center justify-center gap-2 text-base transition-all transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Scraping Apify en cours... ({progressPercent}%)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-amber-300" />
                <span>Lancer le scraping de {sector} à {city}</span>
                <span className="text-[11px] font-extrabold bg-black/25 px-2 py-0.5 rounded-full">
                  −{SEARCH_CREDIT_COST} crédits
                </span>
                <ArrowRight className="w-5 h-5 ml-1" />
              </>
            )}
          </button>
        )}
      </form>

      {/* Footer Info Pill */}
      <div className="mt-6 pt-4 border-t border-emerald-900/40 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Extraction directe des numéros de téléphone Google Maps
        </span>
        <span className="hidden sm:inline text-slate-500">Formatage E.164 automatique (+237...)</span>
      </div>
    </div>
  );
}

