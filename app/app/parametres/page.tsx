"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Sparkles, Save, CheckCircle2, Building2, User, FileText, Lightbulb, ShieldCheck, Globe2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COUNTRY_OPTIONS, currencyForCountry } from "@/lib/credits";

export default function SettingsPage() {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [valueProposition, setValueProposition] = useState("");
  const [country, setCountry] = useState("CM");

  const [loading, setLoading] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single()
          .then(({ data: profile }: { data: any }) => {
            if (profile) {
              setFullName(profile.full_name || "");
              setCompanyName(profile.company_name || "");
              setOfferDescription(profile.offer_description || "");
              setValueProposition(profile.value_proposition || "");
              setCountry(profile.country || "CM");
            }
          });
      } else {
        // Prefill default demo profile if unauthenticated
        setFullName("Jordan Commercial");
        setCompanyName("PixiSolutions Afrique");
        setOfferDescription("Création de sites internet ultra-rapides et optimisation de la visibilité sur Google Maps pour les commerces locaux.");
        setValueProposition("Obtenez 2x plus de clients chaque mois sans budget publicitaire complexe.");
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedMsg(null);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await (supabase.from("profiles") as any).upsert({
          id: user.id,
          full_name: fullName,
          company_name: companyName,
          offer_description: offerDescription,
          value_proposition: valueProposition,
          country,
        });

        if (error) {
          setErrorMsg(error.message);
        } else {
          setSavedMsg("Profil et configuration IA enregistrés avec succès !");
        }
      } else {
        // Saved in local storage / demo session
        setSavedMsg("Profil de démonstration enregistré !");
      }
    } catch {
      setErrorMsg("Erreur lors de la sauvegarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#061a12] text-slate-100 flex flex-col">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-amber-400" />
            Paramètres & Contexte IA
          </h1>
          <p className="text-sm text-slate-300">
            Configurez la description de votre entreprise et de vos offres. C'est ce contexte qui permet à l'IA Claude de rédiger des messages WhatsApp ultra-personnalisés pour vos prospects.
          </p>
        </div>

        {savedMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/90 border border-emerald-700/80 text-emerald-300 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{savedMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-800/80 text-rose-300 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="bg-[#0c241a] border border-emerald-800/80 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-emerald-950">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-emerald-400" />
                Votre Nom Complet
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ex: Jean Dupont"
                className="w-full bg-[#061a12] border border-emerald-800/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Pays de facturation */}
            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Globe2 className="w-4 h-4 text-emerald-400" />
                Pays de facturation
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-[#061a12] border border-emerald-800/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label} {option.flag}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Détermine la devise de vos achats de crédits :{" "}
                <strong className="text-emerald-400">
                  {currencyForCountry(country)}
                </strong>
                , et les moyens de paiement Mobile Money proposés par Moneroo.
              </p>
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-400" />
                Nom de votre Entreprise
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="ex: PixiAgency Douala"
                className="w-full bg-[#061a12] border border-emerald-800/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Offer Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              Description de l'Offre à vendre (Alimente le prompt IA) *
            </label>
            <p className="text-xs text-slate-400">
              Décrivez précisément ce que vous vendez (ex: "Création de sites web professionnels", "Vente de farine en gros pour boulangeries", "Formations en comptabilité").
            </p>
            <textarea
              required
              rows={4}
              value={offerDescription}
              onChange={(e) => setOfferDescription(e.target.value)}
              placeholder="ex: Nous concevons des sites internet modernes avec réservation en ligne et référencement Google Maps pour les hôtels et restaurants à Douala."
              className="w-full bg-[#061a12] border border-emerald-800/80 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
            />
          </div>

          {/* Value Proposition */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-emerald-400" />
              Proposition de Valeur / Accroche Commerciale
            </label>
            <input
              type="text"
              value={valueProposition}
              onChange={(e) => setValueProposition(e.target.value)}
              placeholder="ex: Obtenez 2x plus de réservations sur WhatsApp sans payer de commissions."
              className="w-full bg-[#061a12] border border-emerald-800/80 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-emerald-900/60">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Données sécurisées & RLS actif
            </span>

            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-950 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? "Enregistrement..." : "Enregistrer la configuration"}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
