import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Zap, CheckCircle2, Star, Sparkles } from "lucide-react";
import { generateDemoLeads } from "@/lib/demo-data";
import { LeadsTable } from "@/components/leads/leads-table";

export default function LandingPage() {
  const demoLeads = generateDemoLeads("Agence digitale", "Yaoundé").map((item, idx) => ({
    id: `demo_landing_${idx}`,
    name: item.title || "Entreprise",
    category: item.categoryName || "Agence digitale",
    address: item.address,
    city: item.city,
    phone: item.phone,
    website: item.website,
    email: item.emails?.[0],
    rating: item.totalScore,
    reviews_count: item.reviewsCount,
    maps_url: item.url,
  }));

  return (
    <div className="min-h-screen bg-[#061a12] text-slate-100 flex flex-col font-sans">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#0e3023] border border-emerald-800/80 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-300">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Spécialement conçu pour le marché B2B en Afrique francophone</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.15] max-w-4xl mx-auto">
            Le tool de prospection B2B <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
              le plus intelligent pour votre business
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto font-medium">
            Accédez instantanément à des milliers de numéros de téléphone vérifiés et générez des messages de prospection WhatsApp ultra-personnalisés par IA.
          </p>

          {/* Quick CTA Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link
              href="/login"
              className="btn-magnetic w-full sm:w-auto bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-extrabold text-base px-8 py-4 rounded-2xl shadow-2xl shadow-emerald-950 flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 fill-white" />
              <span>Démarrer Gratuitement (20 Crédits)</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Aucune carte bancaire requise
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Formatage WhatsApp E.164
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Conforme RGPD & Qualité
            </span>
          </div>

          {/* Social Proof Stats */}
          <div className="pt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-[#0c241a] border border-emerald-900/60 p-4 rounded-2xl">
              <div className="text-2xl font-extrabold text-white">+300 000</div>
              <div className="text-xs text-slate-400">Entreprises indexées</div>
            </div>
            <div className="bg-[#0c241a] border border-emerald-900/60 p-4 rounded-2xl">
              <div className="text-2xl font-extrabold text-emerald-400">+10 000</div>
              <div className="text-xs text-slate-400">Leads extraits/mois</div>
            </div>
            <div className="bg-[#0c241a] border border-emerald-900/60 p-4 rounded-2xl">
              <div className="text-2xl font-extrabold text-white">98%</div>
              <div className="text-xs text-slate-400">Numéros WhatsApp valides</div>
            </div>
            <div className="bg-[#0c241a] border border-emerald-900/60 p-4 rounded-2xl">
              <div className="text-2xl font-extrabold text-emerald-400">3x Plus</div>
              <div className="text-xs text-slate-400">De réponses en prospection</div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Interactive Demo Table Preview inspired by Laplead */}
      <section className="py-12 bg-[#04120c] border-y border-emerald-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Aperçu en direct
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Une interface ultra-complète conçue pour les commerciaux
            </h2>
            <p className="text-xs text-slate-400">
              Voici à quoi ressemble votre tableau de bord PixiLead après un scraping de 30 secondes
            </p>
          </div>

          {/* Render the actual table component with demo data */}
          <LeadsTable
            searchId="demo_landing"
            sector="Agence digitale"
            city="Yaoundé"
            country="Cameroun"
            leads={demoLeads}
          />
        </div>
      </section>

      {/* 3 Steps Section (Inspired by FindThatLead) */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-white">Votre générateur tout-en-un de leads B2B</h2>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            Découvrez comment PixiLead simplifie votre prospection commerciale de A à Z.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="bg-[#0c241a] border border-emerald-900/80 rounded-3xl p-8 space-y-4 hover:border-emerald-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 font-extrabold text-xl flex items-center justify-center border border-emerald-500/30">
              1
            </div>
            <h3 className="text-xl font-bold text-white">Trouvez & extrayez vos leads</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Saisissez simplement votre secteur d'activité (boulangeries, hôtels, pharmacies) et votre ville cible. PixiLead scrape Google Maps via Apify en temps réel.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-[#0c241a] border border-emerald-900/80 rounded-3xl p-8 space-y-4 hover:border-emerald-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 font-extrabold text-xl flex items-center justify-center border border-teal-500/30">
              2
            </div>
            <h3 className="text-xl font-bold text-white">LANCEZ VOS MESSAGES WHATSAPP / SMS</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Notre IA Claude analyse chaque fiche (note, avis, absence de site web) et génère 3 variantes de messages WhatsApp ultra-personnalisés en 1 clic.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-[#0c241a] border border-emerald-900/80 rounded-3xl p-8 space-y-4 hover:border-emerald-700 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 font-extrabold text-xl flex items-center justify-center border border-amber-500/30">
              3
            </div>
            <h3 className="text-xl font-bold text-white">Convertissez vos prospects & exportez</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              Exportez votre base au format CSV pour Excel français ou cliquez sur le bouton "Ouvrir dans WhatsApp" pour débuter les échanges immédiatement.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-[#04120c] border-t border-emerald-900/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Ce que disent nos utilisateurs</h2>
            <p className="text-xs text-slate-400">Rejoint par plus de 500 commerciaux et agences en Afrique francophone</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#0c241a] border border-emerald-900/60 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                « PixiLead est l'une de mes plateformes préférées. Trouver les numéros direct WhatsApp de 50 restaurants à Douala me prenait la journée. Désormais c'est réglé en 2 minutes. »
              </p>
              <div className="pt-2 border-t border-emerald-950">
                <div className="font-bold text-white text-xs">Isabel Melo</div>
                <div className="text-[11px] text-slate-400">Digital Project Manager</div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-1">+10 000 numéros extraits/mois</div>
              </div>
            </div>

            <div className="bg-[#0c241a] border border-emerald-900/60 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                « Gagne un temps fou et rend la prospection WhatsApp extrêmement facile. La détection des entreprises sans site web est une mine d'or pour notre agence Web. »
              </p>
              <div className="pt-2 border-t border-emerald-950">
                <div className="font-bold text-white text-xs">Nisha Bajaj</div>
                <div className="text-[11px] text-slate-400">Marketing & Growth Leader</div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-1">+50% de RDV obtenus</div>
              </div>
            </div>

            <div className="bg-[#0c241a] border border-emerald-900/60 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed italic">
                « Le meilleur booster de clients B2B pour le marché local. L'exportation CSV propre avec le point-virgule et les accents Excel est impeccable. »
              </p>
              <div className="pt-2 border-t border-emerald-950">
                <div className="font-bold text-white text-xs">Raúl Rodríguez</div>
                <div className="text-[11px] text-slate-400">Customer Intelligence Manager</div>
                <div className="text-[10px] text-emerald-400 font-semibold mt-1">50% de taux d'ouverture WhatsApp</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-emerald-900/60 bg-[#04120c] py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            © {new Date().getFullYear()} PixiLead — Solution SaaS de Prospection B2B Afrique. Tous droits réservés.
          </div>
          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-emerald-400">Se connecter</Link>
            <Link href="/app" className="hover:text-emerald-400">Lancer une recherche</Link>
            <Link href="/app/parametres" className="hover:text-emerald-400">Paramètres IA</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
