"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Coins,
  ArrowRight,
  Clock,
} from "lucide-react";
import { authFetch } from "@/lib/supabase/auth-fetch";

type PaymentState = {
  status: "pending" | "completed" | "failed" | "expired" | string;
  credits: number;
  balance: number;
  failureReason?: string | null;
};

/** Nombre de sondages avant d'abandonner (≈ 90 s à 3 s d'intervalle). */
const MAX_POLLS = 30;

function ReturnContent() {
  const searchParams = useSearchParams();
  // `ref` est notre UUID : Moneroo ajoute de son côté `paymentId` et
  // `paymentStatus` à l'URL de retour, qu'on n'utilise pas (non authentifiés).
  const paymentRef = searchParams.get("ref");

  const [state, setState] = useState<PaymentState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const pollCount = useRef(0);

  const poll = useCallback(async (): Promise<boolean> => {
    if (!paymentRef) return true;
    try {
      const res = await authFetch(`/api/credits/payments/${paymentRef}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Impossible de vérifier le paiement.");
        return true;
      }
      const data: PaymentState = await res.json();
      setState(data);
      return data.status !== "pending";
    } catch {
      return false; // erreur transitoire : on retente
    }
  }, [paymentRef]);

  useEffect(() => {
    if (!paymentRef) {
      setErrorMsg("Référence de paiement manquante dans l'URL.");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      const done = await poll();
      if (cancelled) return;
      if (done) return;

      pollCount.current += 1;
      if (pollCount.current >= MAX_POLLS) {
        setTimedOut(true);
        return;
      }
      timer = setTimeout(run, 3000);
    };

    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [paymentRef, poll]);

  const status = state?.status;
  const isDone = status === "completed";
  const isFailed = status === "failed" || status === "expired";

  return (
    <div className="min-h-screen bg-[#0b1915] text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-16 w-full">
        <div className="glass-card rounded-3xl p-8 sm:p-10 text-center space-y-6 border border-emerald-800/60">
          {errorMsg ? (
            <>
              <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
                <XCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-extrabold text-white">
                  Vérification impossible
                </h1>
                <p className="text-sm text-slate-400">{errorMsg}</p>
              </div>
            </>
          ) : isDone ? (
            <>
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-extrabold text-white">
                  Paiement confirmé 🎉
                </h1>
                <p className="text-sm text-slate-300">
                  <strong className="text-emerald-400">
                    +{state?.credits} crédits
                  </strong>{" "}
                  ont été ajoutés à votre compte.
                </p>
              </div>
              <div className="bg-[#061a12] border border-emerald-900/60 rounded-2xl p-4 flex items-center justify-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-slate-400">Nouveau solde :</span>
                <span className="stat-number text-xl font-extrabold text-white">
                  {state?.balance}
                </span>
              </div>
            </>
          ) : isFailed ? (
            <>
              <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
                <XCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-extrabold text-white">
                  Paiement non abouti
                </h1>
                <p className="text-sm text-slate-400">
                  {state?.failureReason ||
                    "La transaction n'a pas été finalisée. Aucun crédit n'a été débité."}
                </p>
              </div>
            </>
          ) : timedOut ? (
            <>
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto">
                <Clock className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-extrabold text-white">
                  Confirmation en attente
                </h1>
                <p className="text-sm text-slate-400">
                  Votre opérateur met plus de temps que prévu. Vos crédits
                  seront ajoutés automatiquement dès la confirmation — vous
                  pouvez fermer cette page en toute sécurité.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-2">
                <h1 className="text-xl font-extrabold text-white">
                  Confirmation du paiement…
                </h1>
                <p className="text-sm text-slate-400">
                  Validez la transaction sur votre téléphone si votre opérateur
                  vous le demande. Cette page se met à jour toute seule.
                </p>
              </div>
            </>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/app"
              className="btn-magnetic flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
            >
              <span>Lancer une recherche</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/app/credits"
              className="flex-1 bg-[#122b22] hover:bg-[#163429] border border-emerald-500/30 text-slate-200 font-bold py-3 px-4 rounded-xl text-sm flex items-center justify-center transition-colors"
            >
              Retour aux crédits
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function CreditsReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b1915] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      }
    >
      <ReturnContent />
    </Suspense>
  );
}
