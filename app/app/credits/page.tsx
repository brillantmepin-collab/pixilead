"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import {
  Coins,
  Sparkles,
  Loader2,
  Check,
  ArrowRight,
  Search,
  MessageSquare,
  History,
  ShieldCheck,
  Smartphone,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { authFetch, readApiError } from "@/lib/supabase/auth-fetch";
import { formatAmount, reasonLabel, type Currency } from "@/lib/credits";

type Pack = {
  id: string;
  name: string;
  credits: number;
  tagline: string;
  popular: boolean;
  amount: number;
  currency: Currency;
};

type Transaction = {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  created_at: string;
};

type CreditsPayload = {
  balance: number;
  currency: Currency;
  costs: { search: number; aiMessage: number };
  packs: Pack[];
  transactions: Transaction[];
};

export default function CreditsPage() {
  const [data, setData] = useState<CreditsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [buyingPackId, setBuyingPackId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch("/api/credits");
      if (!res.ok) {
        const err = await readApiError(res);
        setNeedsLogin(err.needsLogin);
        setErrorMsg(err.message);
        return;
      }
      setData(await res.json());
      setNeedsLogin(false);
    } catch {
      setErrorMsg("Impossible de charger votre solde de crédits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleBuy = async (packId: string) => {
    setBuyingPackId(packId);
    setErrorMsg(null);
    try {
      const res = await authFetch("/api/credits/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      if (!res.ok) {
        const err = await readApiError(res);
        setNeedsLogin(err.needsLogin);
        setErrorMsg(err.message);
        setBuyingPackId(null);
        return;
      }

      const { checkoutUrl } = await res.json();
      if (!checkoutUrl) {
        setErrorMsg("Moneroo n'a pas renvoyé de lien de paiement.");
        setBuyingPackId(null);
        return;
      }
      // Redirection vers la page hébergée Moneroo (Mobile Money + carte).
      window.location.href = checkoutUrl;
    } catch {
      setErrorMsg("Impossible de joindre le service de paiement.");
      setBuyingPackId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1915] text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <Coins className="w-7 h-7 text-amber-400" />
            Vos crédits PixiLead
          </h1>
          <p className="text-sm text-slate-400">
            Rechargez par Mobile Money (MTN, Orange Money, Wave…) ou par carte
            bancaire, via Moneroo.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p>{errorMsg}</p>
              {needsLogin && (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Se connecter
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="glass-card rounded-3xl p-12 flex items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span className="text-sm">Chargement de votre solde…</span>
          </div>
        ) : data ? (
          <>
            {/* Solde + barème */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="glass-card rounded-3xl p-6 border border-amber-500/30 space-y-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Solde disponible
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="stat-number text-5xl font-extrabold text-white">
                    {data.balance}
                  </span>
                  <span className="text-sm font-bold text-amber-400">
                    crédit{data.balance > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Soit {Math.floor(data.balance / data.costs.search)} recherche
                  {Math.floor(data.balance / data.costs.search) > 1 ? "s" : ""} de
                  leads.
                </p>
              </div>

              <div className="glass-card rounded-3xl p-6 border border-emerald-800/60 space-y-3 lg:col-span-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Barème
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 bg-[#061a12] border border-emerald-900/60 rounded-2xl p-3.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {data.costs.search} crédits
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Une recherche, quel que soit le nombre de fiches
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-[#061a12] border border-emerald-900/60 rounded-2xl p-3.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {data.costs.aiMessage} crédit
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Un message de prospection généré par l&apos;IA
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Packs */}
            <div id="packs" className="space-y-4 scroll-mt-24">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Recharger mon compte
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.packs.map((pack) => (
                  <div
                    key={pack.id}
                    className={`glass-card glass-card-hover rounded-3xl p-6 space-y-4 flex flex-col relative ${
                      pack.popular
                        ? "border-2 border-emerald-500/70 shadow-xl shadow-emerald-950"
                        : "border border-emerald-800/60"
                    }`}
                  >
                    {pack.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg">
                        Le plus choisi
                      </span>
                    )}

                    <div className="space-y-1">
                      <h3 className="text-lg font-extrabold text-white">
                        {pack.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">{pack.tagline}</p>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="stat-number text-3xl font-extrabold text-emerald-400">
                        {pack.credits}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        crédits
                      </span>
                    </div>

                    <div className="text-2xl font-extrabold text-white stat-number">
                      {formatAmount(pack.amount, pack.currency)}
                    </div>

                    <ul className="space-y-1.5 text-[11px] text-slate-300 flex-1">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        {Math.floor(pack.credits / data.costs.search)} recherches
                        de leads
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        Export CSV illimité
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        Crédits sans expiration
                      </li>
                    </ul>

                    <button
                      onClick={() => handleBuy(pack.id)}
                      disabled={buyingPackId !== null}
                      className="btn-magnetic w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {buyingPackId === pack.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Ouverture du paiement…</span>
                        </>
                      ) : (
                        <>
                          <span>Acheter</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                  MTN MoMo, Orange Money, Wave, Moov, Airtel
                </span>
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  Visa / Mastercard
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Paiement sécurisé par Moneroo
                </span>
              </div>
            </div>

            {/* Historique */}
            <div className="space-y-4">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-400" />
                Historique de vos crédits
              </h2>

              <div className="glass-card rounded-3xl overflow-hidden">
                <div className="divide-y divide-emerald-900/40">
                  {data.transactions.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">
                      Aucun mouvement pour le moment.
                    </div>
                  ) : (
                    data.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-4 flex items-center justify-between gap-4 hover:bg-[#082218]/90 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-white">
                            {reasonLabel(tx.reason)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {new Date(tx.created_at).toLocaleString("fr-FR")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`stat-number text-sm font-extrabold ${
                              tx.delta > 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {tx.delta > 0 ? "+" : ""}
                            {tx.delta}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            solde : {tx.balance_after}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
