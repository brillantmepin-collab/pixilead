"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Coins, Plus, LogOut, ArrowRight, Menu, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { SIGNUP_FREE_CREDITS, CREDITS_EVENT } from "@/lib/credits";

export function Navbar() {
  const pathname = usePathname();
  const [isAuth, setIsAuth] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [credits, setCredits] = useState<number>(SIGNUP_FREE_CREDITS);

  const refreshCredits = useCallback(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase
        .from("profiles")
        .select("credits")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }: { data: any }) => {
          if (profile && typeof profile.credits === "number") {
            setCredits(profile.credits);
          }
        });
    });
  }, []);

  useEffect(() => {
    // Check local auth session cookie or supabase session
    const hasSession = document.cookie.includes("pixilead_auth_session=true");
    setIsAuth(hasSession);
    if (hasSession) refreshCredits();
  }, [pathname, refreshCredits]);

  // Mise à jour immédiate après un débit ou un achat.
  useEffect(() => {
    const onCreditsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ balance?: number }>).detail;
      if (typeof detail?.balance === "number") {
        setCredits(detail.balance);
      } else {
        refreshCredits();
      }
    };
    window.addEventListener(CREDITS_EVENT, onCreditsChanged);
    return () => window.removeEventListener(CREDITS_EVENT, onCreditsChanged);
  }, [refreshCredits]);

  const handleLogout = () => {
    document.cookie = "pixilead_auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0b1915]/90 backdrop-blur-xl border-b border-emerald-500/20 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-400 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-200 ring-1 ring-emerald-400/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white flex items-center gap-1.5">
              Pixi<span className="text-gradient-emerald">Lead</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#122b22] text-emerald-300 border border-emerald-500/30">
                Afrique
              </span>
            </span>
          </div>
        </Link>

        {/* Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold">
          <Link
            href="/"
            className={`relative py-1 transition-colors hover:text-emerald-400 ${
              pathname === "/" ? "text-emerald-400 font-bold" : "text-slate-300"
            }`}
          >
            Accueil
            {pathname === "/" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" />
            )}
          </Link>
          <Link
            href="/app"
            className={`relative py-1 transition-colors hover:text-emerald-400 ${
              pathname === "/app" ? "text-emerald-400 font-bold" : "text-slate-300"
            }`}
          >
            Dashboard & Scraping
            {pathname === "/app" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" />
            )}
          </Link>
          <Link
            href="/app/credits"
            className={`relative py-1 transition-colors hover:text-emerald-400 ${
              pathname === "/app/credits" ? "text-emerald-400 font-bold" : "text-slate-300"
            }`}
          >
            Crédits
            {pathname === "/app/credits" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" />
            )}
          </Link>
          <Link
            href="/app/parametres"
            className={`relative py-1 transition-colors hover:text-emerald-400 ${
              pathname === "/app/parametres" ? "text-emerald-400 font-bold" : "text-slate-300"
            }`}
          >
            Paramètres & Offre IA
            {pathname === "/app/parametres" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full" />
            )}
          </Link>
        </nav>

        {/* Right Actions / Credits */}
        <div className="flex items-center gap-3">
          {isAuth ? (
            <>
              <Link
                href="/app/credits"
                title="Voir mes crédits et recharger"
                className={`hidden sm:flex items-center gap-2 bg-[#122b22] border rounded-full px-3.5 py-1.5 text-xs shadow-sm transition-colors hover:border-emerald-400 ${
                  credits <= 0
                    ? "border-rose-500/50 text-rose-300"
                    : "border-emerald-500/30 text-emerald-300"
                }`}
              >
                <Coins
                  className={`w-3.5 h-3.5 shrink-0 ${
                    credits <= 0 ? "text-rose-400" : "text-amber-400"
                  }`}
                />
                <span className="font-semibold">
                  <strong className="stat-number text-white font-bold">{credits}</strong>{" "}
                  <span className="text-[11px] text-slate-300">
                    crédit{credits > 1 ? "s" : ""}
                  </span>
                </span>
              </Link>

              <Link
                href="/app/credits"
                className="btn-magnetic hidden sm:flex bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Recharger</span>
              </Link>

              <button
                onClick={handleLogout}
                title="Se déconnecter"
                className="hidden sm:flex p-2 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-slate-300 hover:text-white text-xs font-semibold px-3 py-1.5 transition-colors hidden sm:inline"
              >
                Se connecter
              </Link>
              <Link
                href="/login"
                className="btn-magnetic bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5"
              >
                <span>Démarrer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white hover:bg-[#122b22] border border-emerald-500/20"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0b1915] border-b border-emerald-500/30 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col space-y-2 text-sm font-semibold">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-xl transition-colors ${
                pathname === "/" ? "bg-[#122b22] text-emerald-400" : "text-slate-300 hover:bg-[#122b22]"
              }`}
            >
              Accueil
            </Link>
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-xl transition-colors ${
                pathname === "/app" ? "bg-[#122b22] text-emerald-400" : "text-slate-300 hover:bg-[#122b22]"
              }`}
            >
              Dashboard & Scraping
            </Link>
            <Link
              href="/app/credits"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-xl transition-colors flex items-center justify-between ${
                pathname === "/app/credits" ? "bg-[#122b22] text-emerald-400" : "text-slate-300 hover:bg-[#122b22]"
              }`}
            >
              <span>Crédits & Recharge</span>
              <span className="flex items-center gap-1 text-xs">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <strong className="text-white">{credits}</strong>
              </span>
            </Link>
            <Link
              href="/app/parametres"
              onClick={() => setMobileMenuOpen(false)}
              className={`p-2.5 rounded-xl transition-colors ${
                pathname === "/app/parametres" ? "bg-[#122b22] text-emerald-400" : "text-slate-300 hover:bg-[#122b22]"
              }`}
            >
              Paramètres & Offre IA
            </Link>
          </nav>

          {isAuth && (
            <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
              <span className="text-emerald-300">
                <strong className="text-white">{credits}</strong> crédit
                {credits > 1 ? "s" : ""} disponible{credits > 1 ? "s" : ""}
              </span>
              <button
                onClick={handleLogout}
                className="text-rose-400 font-bold flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}


