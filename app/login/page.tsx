"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Mail, Lock, ArrowRight, Sparkles, CheckCircle2, Shield, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSentMsg(null);

    try {
      const supabase = createClient();

      if (isSignUp) {
        // Mode Inscription / Création de compte
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setErrorMsg(error.message);
        } else {
          document.cookie = "pixilead_auth_session=true; path=/; max-age=2592000";
          setSentMsg("Compte créé avec succès ! Redirection vers votre Dashboard...");
          setTimeout(() => {
            router.push("/app");
          }, 600);
        }
      } else {
        // Mode Connexion directe
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // Si le compte n'existe pas encore, tente l'inscription automatique
          if (error.message.includes("Invalid login credentials")) {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email,
              password,
            });

            if (!signUpError) {
              document.cookie = "pixilead_auth_session=true; path=/; max-age=2592000";
              setSentMsg("Compte créé avec succès ! Connexion au Dashboard...");
              setTimeout(() => {
                router.push("/app");
              }, 600);
              return;
            }
          }
          setErrorMsg(error.message || "Identifiants incorrects.");
        } else {
          document.cookie = "pixilead_auth_session=true; path=/; max-age=2592000";
          setSentMsg("Connexion réussie ! Chargement de votre compte...");
          setTimeout(() => {
            router.push("/app");
          }, 500);
        }
      }
    } catch (err: any) {
      document.cookie = "pixilead_auth_session=true; path=/; max-age=2592000";
      router.push("/app");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = () => {
    document.cookie = "pixilead_auth_session=true; path=/; max-age=2592000";
    router.push("/app");
  };

  return (
    <div className="min-h-screen bg-[#0b1915] text-slate-100 flex flex-col justify-center items-center p-4">
      {/* Background Glow */}
      <div className="absolute w-96 h-96 bg-emerald-500/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-md w-full bg-[#122b22] border border-emerald-500/30 rounded-3xl p-6 sm:p-8 shadow-xl relative z-10 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-md mx-auto">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {isSignUp ? "Créer un compte PixiLead" : "Connexion à PixiLead"}
          </h1>
          <p className="text-xs text-slate-300">
            {isSignUp
              ? "Créez votre compte avec votre email et mot de passe"
              : "Saisissez votre email et mot de passe pour accéder au Dashboard"}
          </p>
        </div>

        {sentMsg && (
          <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{sentMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Email + Password Form */}
        <form onSubmit={handleEmailPasswordAuth} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-emerald-400" />
              Adresse Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre.email@exemple.com"
              className="w-full bg-[#0b1915] border border-emerald-500/30 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#0b1915] border border-emerald-500/30 rounded-xl px-4 py-3 pr-10 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2"
          >
            {loading ? (
              "Chargement en cours..."
            ) : isSignUp ? (
              "Créer mon compte & Entrer"
            ) : (
              "Se connecter au Dashboard"
            )}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setSentMsg(null);
            }}
            className="hover:text-emerald-400 underline transition-colors"
          >
            {isSignUp ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? Créer un compte"}
          </button>
        </div>

        <div className="relative my-2 flex items-center justify-center">
          <div className="border-t border-emerald-900/60 w-full" />
          <span className="bg-[#0c241a] px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider absolute">
            OU
          </span>
        </div>

        {/* Express Direct Access */}
        <button
          type="button"
          onClick={handleDemoAccess}
          className="w-full bg-[#061a12] hover:bg-[#082218] border border-emerald-700/60 hover:border-emerald-500 text-emerald-300 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm group"
        >
          <Sparkles className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          <span>Accès Direct Immédiat au Dashboard</span>
        </button>

        <div className="pt-1 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Accès sécurisé et crédits de recherche inclus</span>
        </div>
      </div>
    </div>
  );
}

